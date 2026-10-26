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

  // Determine SSL configuration
  let sslConfig: boolean | { rejectUnauthorized: boolean } = false;
  if (!isLocalhost && !databaseUrl.includes("sslmode=disable")) {
    sslConfig = { rejectUnauthorized: false };
  }

  globalPool = new PgPool({
    connectionString: databaseUrl,
    max: parseInt(process.env.DB_POOL_MAX || "20", 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || "30000", 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || "5000", 10),
    ssl: sslConfig,
  });

  globalPool.on("error", (err: Error) => {
    console.error("[PostgreSQL Pool Error]: Unexpected client error on idle client", err);
  });

  return globalPool;
}

/**
 * Execute a parameterized query with bounded timeout and safe error handling
 */
export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<R>> {
  const pool = getPgPool();
  try {
    return await pool.query<R>(text, params);
  } catch (err) {
    console.error("[PostgreSQL Query Error]:", {
      query: text.slice(0, 100),
      error: err instanceof Error ? err.message : String(err),
    });
    throw new DatabaseUnavailableError("Database query execution failed.", err);
  }
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
  error?: string;
}> {
  const start = Date.now();
  try {
    if (!isPostgresConfigured()) {
      return {
        status: "unhealthy",
        latencyMs: 0,
        error: "DATABASE_URL is not configured.",
      };
    }
    const pool = getPgPool();
    await pool.query("SELECT 1 AS healthcheck");
    const latencyMs = Date.now() - start;
    return { status: "healthy", latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "unhealthy", latencyMs, error: msg };
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
