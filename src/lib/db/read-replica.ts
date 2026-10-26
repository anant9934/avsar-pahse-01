import pg from "pg";
const { Pool: PgPool } = pg;
import type { Pool, QueryResult, QueryResultRow } from "pg";
import { executeWithBreaker } from "../circuit-breaker/index.ts";
import {
  getPgPool,
  isPostgresConfigured,
  DatabaseUnavailableError,
} from "./postgres.ts";

let readReplicaPool: Pool | null = null;

export function getReadDatabaseUrl(): string | null {
  const readUrl =
    process.env.POSTGRES_READ_URL ||
    process.env.NEON_DATABASE_READ_URL ||
    process.env.DATABASE_READ_URL;
  if (readUrl && readUrl.trim()) {
    return readUrl.trim();
  }
  return null;
}

export function hasDedicatedReadReplica(): boolean {
  return Boolean(getReadDatabaseUrl());
}

/**
 * Returns the read-optimized connection pool.
 * Uses dedicated read replica if configured; otherwise returns primary pool.
 */
export function getReadPool(): Pool {
  const readUrl = getReadDatabaseUrl();
  if (!readUrl) {
    return getPgPool();
  }

  if (!readReplicaPool) {
    const isLocal = readUrl.includes("localhost") || readUrl.includes("127.0.0.1");
    readReplicaPool = new PgPool({
      connectionString: readUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: parseInt(process.env.DB_READ_POOL_MAX || "15", 10),
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
    });

    readReplicaPool.on("error", (err) => {
      console.error("[PostgreSQL Read Replica Pool Error]", err);
    });
  }

  return readReplicaPool;
}

/**
 * Returns the write-optimized primary database connection pool.
 */
export function getWritePool(): Pool {
  return getPgPool();
}

/**
 * Executes a read query against the read replica pool with circuit breaker protection.
 * If read replica fails, automatically falls back to primary write pool.
 */
export async function queryRead<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<R>> {
  if (!isPostgresConfigured()) {
    throw new DatabaseUnavailableError("PostgreSQL connection string is not configured.");
  }

  return executeWithBreaker(
    "neon_db_read",
    async () => {
      try {
        const pool = getReadPool();
        return await pool.query<R>(text, params);
      } catch (err: unknown) {
        if (hasDedicatedReadReplica()) {
          console.warn("[Read Replica Failover] Falling back to primary database write pool.");
          return await getWritePool().query<R>(text, params);
        }
        throw err;
      }
    }
  );
}

/**
 * Executes a write query against the primary database pool.
 */
export async function queryWrite<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<R>> {
  if (!isPostgresConfigured()) {
    throw new DatabaseUnavailableError("PostgreSQL connection string is not configured.");
  }

  return executeWithBreaker(
    "neon_db",
    async () => {
      const pool = getWritePool();
      return await pool.query<R>(text, params);
    }
  );
}

/**
 * Resets pools for testing isolation.
 */
export async function resetPoolsForTesting(): Promise<void> {
  if (readReplicaPool) {
    await readReplicaPool.end().catch(() => {});
    readReplicaPool = null;
  }
}
