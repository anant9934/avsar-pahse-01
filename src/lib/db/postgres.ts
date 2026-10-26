import pg from "pg";
const { Pool: PgPool } = pg;
import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import fs from "node:fs";
import path from "node:path";

let globalPool: Pool | null = null;

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigurationError";
  }
}

export class DatabaseUnavailableError extends Error {
  cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DatabaseUnavailableError";
    this.cause = cause;
  }
}

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== "");
}

/**
 * Detect whether connection string targets Neon Serverless PostgreSQL
 */
export function isNeonDatabase(url = process.env.DATABASE_URL): boolean {
  if (!url || typeof url !== "string") return false;
  return url.toLowerCase().includes("neon.tech");
}

/**
 * Detect whether connection string uses Neon's PgBouncer connection pooler endpoint
 */
export function isNeonPooledConnection(url = process.env.DATABASE_URL): boolean {
  if (!url || !isNeonDatabase(url)) return false;
  return url.toLowerCase().includes("-pooler.");
}

/**
 * Safely mask database credentials in connection strings for logging/diagnostics
 */
export function maskConnectionString(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "******";
    }
    return parsed.toString();
  } catch {
    return url.replace(/:([^@/]+)@/, ":******@");
  }
}

/**
 * Extract sanitized database metadata for telemetry and health status without credential exposure
 */
export function getDatabaseProviderInfo(): {
  provider: "neon" | "postgres" | "unconfigured";
  isPooled: boolean;
  host: string | null;
  isProductionReady: boolean;
} {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    return {
      provider: "unconfigured",
      isPooled: false,
      host: null,
      isProductionReady: false,
    };
  }

  const isNeon = isNeonDatabase(url);
  const isPooled = isNeonPooledConnection(url);

  let host: string | null = null;
  try {
    const parsed = new URL(url);
    host = parsed.host;
  } catch {
    const match = url.match(/@([^:/]+)/);
    host = match ? match[1] : null;
  }

  return {
    provider: isNeon ? "neon" : "postgres",
    isPooled,
    host,
    isProductionReady: isNeon ? isPooled : Boolean(url),
  };
}

export function getPgPool(): Pool {
  if (globalPool) {
    return globalPool;
  }

  const databaseUrl = process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === "production";

  if (!databaseUrl || databaseUrl.trim() === "") {
    if (isProduction) {
      throw new DatabaseConfigurationError(
        "DATABASE_URL is not configured in production environment. Application refuses to start with ephemeral storage."
      );
    }
    throw new DatabaseConfigurationError("DATABASE_URL is not set.");
  }

  const isLocalhost =
    databaseUrl.includes("localhost") ||
    databaseUrl.includes("127.0.0.1") ||
    databaseUrl.includes(".internal");

  const isNeon = isNeonDatabase(databaseUrl);

  // Determine SSL configuration
  let sslConfig: boolean | { rejectUnauthorized: boolean } = false;
  if (isNeon) {
    // Neon serverless endpoints enforce TLS encryption
    sslConfig = { rejectUnauthorized: false };
  } else if (!isLocalhost && !databaseUrl.includes("sslmode=disable")) {
    sslConfig = { rejectUnauthorized: false };
  }

  const statementTimeout = parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || "3000", 10);
  const queryTimeout = parseInt(process.env.DB_QUERY_TIMEOUT_MS || "5000", 10);
  const poolMax = parseInt(process.env.DB_POOL_MAX || (isNeon ? "10" : "20"), 10);

  globalPool = new PgPool({
    connectionString: databaseUrl,
    max: poolMax,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || "30000", 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || "5000", 10),
    statement_timeout: statementTimeout,
    query_timeout: queryTimeout,
    ssl: sslConfig,
  });

  globalPool.on("error", (err: Error) => {
    console.error("[PostgreSQL Pool Error]: Unexpected client error on idle client", err);
  });

  return globalPool;
}

/**
 * Determine whether a database error is transient (safe to retry)
 */
export function isTransientDatabaseError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";

  return (
    code === "57P01" || // admin_shutdown
    code === "57P02" || // crash_shutdown
    code === "57P03" || // cannot_connect_now
    code === "08000" || // connection_exception
    code === "08003" || // connection_does_not_exist
    code === "08006" || // connection_failure
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    msg.includes("connection terminated") ||
    msg.includes("socket closed") ||
    msg.includes("server closed the connection") ||
    msg.includes("connection timeout")
  );
}

/**
 * Execute a database operation with exponential backoff and jitter for transient errors
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 50
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries || !isTransientDatabaseError(err)) {
        throw err;
      }
      const jitter = Math.random() * 25;
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1) + jitter, 1000);
      console.warn(`[PostgreSQL Transient Retry] Attempt ${attempt}/${maxRetries} after ${delay.toFixed(0)}ms:`, err instanceof Error ? err.message : String(err));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Execute a parameterized query with bounded timeout and safe error handling
 */
export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<R>> {
  const pool = getPgPool();
  const isSelect = text.trim().toUpperCase().startsWith("SELECT");

  const runQuery = async () => {
    try {
      return await pool.query<R>(text, params);
    } catch (err) {
      console.error("[PostgreSQL Query Error]:", {
        query: text.slice(0, 100),
        error: err instanceof Error ? err.message : String(err),
      });
      throw new DatabaseUnavailableError("Database query execution failed.", err);
    }
  };

  // Automatically retry read-only queries on transient network drops
  if (isSelect) {
    return await executeWithRetry(runQuery, 2, 50);
  }
  return await runQuery();
}

/**
 * Execute database operations within an atomic ACID transaction
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("[PostgreSQL Transaction Rollback Error]:", rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Live health check validating PostgreSQL connection and latency
 */
export async function checkDatabaseHealth(): Promise<{
  status: "healthy" | "unhealthy";
  latencyMs: number;
  provider?: "neon" | "postgres";
  isPooled?: boolean;
  error?: string;
}> {
  const start = Date.now();
  const info = getDatabaseProviderInfo();
  try {
    if (!isPostgresConfigured()) {
      return {
        status: "unhealthy",
        latencyMs: 0,
        provider: info.provider === "unconfigured" ? "postgres" : info.provider,
        isPooled: info.isPooled,
        error: "DATABASE_URL is not configured.",
      };
    }
    const pool = getPgPool();
    await pool.query("SELECT 1 AS healthcheck");
    const latencyMs = Date.now() - start;
    return {
      status: "healthy",
      latencyMs,
      provider: info.provider === "unconfigured" ? "postgres" : info.provider,
      isPooled: info.isPooled,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "unhealthy",
      latencyMs,
      provider: info.provider === "unconfigured" ? "postgres" : info.provider,
      isPooled: info.isPooled,
      error: msg,
    };
  }
}

/**
 * Initialize PostgreSQL tables and indexes from schema.sql
 */
export async function initPostgresSchema(poolOrClient?: Pool | PoolClient): Promise<void> {
  const schemaPath = path.join(process.cwd(), "src", "lib", "db", "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  const runner = poolOrClient || getPgPool();
  await runner.query(schemaSql);
}

/**
 * Close PostgreSQL pool (used during graceful shutdown and testing)
 */
export async function closePgPool(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
  }
}

/**
 * Reset pool instance (primarily used for test mocking)
 */
export function setGlobalPool(pool: Pool | null): void {
  globalPool = pool;
}
