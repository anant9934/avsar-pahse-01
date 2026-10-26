import type { Pool, PoolClient } from "pg";

export type IsolationLevel = "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";

export interface TransactionOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  isolationLevel?: IsolationLevel;
}

// PostgreSQL error codes for concurrency conflicts that are safe to retry
export const RETRYABLE_PG_CODES = new Set([
  "40001", // serialization_failure
  "40P01", // deadlock_detected
  "55P03", // lock_not_available
]);

let savepointCounter = 0;

/**
 * Executes a callback within a managed database transaction.
 * 
 * Supports:
 * 1. Automatic SAVEPOINTs for nested calls.
 * 2. Automatic exponential backoff and jitter retry on serialization conflicts (SQLSTATE 40001 / 40P01).
 * 3. Automatic ROLLBACK and connection release on error.
 */
export async function withTransaction<T>(
  poolOrClient: Pool | PoolClient,
  operation: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 50;
  const isolationLevel = options.isolationLevel;

  const isPool = typeof (poolOrClient as Pool).connect === "function";

  let attempt = 0;

  while (true) {
    attempt++;
    const client: PoolClient = isPool
      ? await (poolOrClient as Pool).connect()
      : (poolOrClient as PoolClient);

    const isNested = !isPool;
    const savepointName = `sp_${++savepointCounter}`;

    try {
      if (isNested) {
        await client.query(`SAVEPOINT ${savepointName}`);
      } else {
        if (isolationLevel) {
          await client.query(`BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
        } else {
          await client.query("BEGIN");
        }
      }

      const result = await operation(client);

      if (isNested) {
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
      } else {
        await client.query("COMMIT");
      }

      return result;
    } catch (err: unknown) {
      // 1. Rollback
      try {
        if (isNested) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        } else {
          await client.query("ROLLBACK");
        }
      } catch {
        // Rollback failed; connection might be severed
      }

      const pgCode = (err as { code?: string })?.code;
      const isRetryable = pgCode && RETRYABLE_PG_CODES.has(pgCode);

      if (isRetryable && attempt <= maxRetries) {
        // Exponential backoff with jitter: delay = baseDelay * (2 ^ attempt) + random(0, 50ms)
        const backoff = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 50;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      throw err;
    } finally {
      if (isPool) {
        try {
          client.release();
        } catch {
          // Best effort release
        }
      }
    }
  }
}
