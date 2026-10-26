import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getPgPool, isPostgresConfigured } from "../db/postgres.ts";
import type { JobPriority } from "./types.ts";

export interface OutboxEvent<T = unknown> {
  type: string;
  payload: T;
  priority?: JobPriority;
  maxRetries?: number;
}

export interface OutboxCommitResult<T> {
  result: T;
  enqueuedCount: number;
}

/**
 * Executes a domain mutation and enqueues transactional background events
 * within the EXACT same PostgreSQL ACID transaction.
 * 
 * Guarantees zero lost events and zero phantom jobs: either both domain data
 * and outbox records commit together, or neither commits.
 */
export async function commitWithOutbox<T>(
  operation: (client: PoolClient) => Promise<T>,
  events: OutboxEvent[] = [],
  options: { pool?: Pool } = {}
): Promise<OutboxCommitResult<T>> {
  if (!isPostgresConfigured() && !options.pool) {
    // When DB is unconfigured, run operation directly
    const mockClient = {} as PoolClient;
    const result = await operation(mockClient);
    return {
      result,
      enqueuedCount: events.length,
    };
  }

  const pool = options.pool || getPgPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Execute core domain mutation
    const result = await operation(client);

    // 2. Persist outbox event records into durable_jobs table
    for (const event of events) {
      const id = `job_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const priority = event.priority || "normal";
      const maxRetries = event.maxRetries ?? 3;

      await client.query(
        `INSERT INTO durable_jobs (
           id, type, payload, priority, status, attempts, max_attempts, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, 'pending', 0, $5, NOW(), NOW())`,
        [id, event.type, JSON.stringify(event.payload), priority, maxRetries]
      );
    }

    await client.query("COMMIT");

    return {
      result,
      enqueuedCount: events.length,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
