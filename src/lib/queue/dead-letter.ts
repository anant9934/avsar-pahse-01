import type { Pool } from "pg";
import { getPgPool, isPostgresConfigured } from "../db/postgres.ts";
import type { JobPriority } from "./types.ts";

export interface DeadLetterRecord {
  id: string;
  type: string;
  payload: unknown;
  priority: JobPriority;
  attempts: number;
  maxAttempts: number;
  failedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeadLetterSummary {
  totalFailed: number;
  byType: Record<string, number>;
  commonReasons: Array<{ reason: string; count: number }>;
}

export async function listDeadLetterJobs(options: {
  type?: string;
  limit?: number;
  offset?: number;
  pool?: Pool;
} = {}): Promise<DeadLetterRecord[]> {
  if (!isPostgresConfigured() && !options.pool) {
    return [];
  }

  const pool = options.pool || getPgPool();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const res = await pool.query<{
    id: string;
    type: string;
    payload: unknown;
    priority: JobPriority;
    attempts: number;
    max_attempts: number;
    failed_reason: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, type, payload, priority, attempts, max_attempts, failed_reason, created_at, updated_at
     FROM durable_jobs
     WHERE status = 'failed' AND ($1::varchar IS NULL OR type = $1)
     ORDER BY updated_at DESC
     LIMIT $2 OFFSET $3`,
    [options.type || null, limit, offset]
  );

  return res.rows.map((row) => ({
    id: row.id,
    type: row.type,
    payload: row.payload,
    priority: row.priority,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    failedReason: row.failed_reason,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function getDeadLetterSummary(options: { pool?: Pool } = {}): Promise<DeadLetterSummary> {
  if (!isPostgresConfigured() && !options.pool) {
    return { totalFailed: 0, byType: {}, commonReasons: [] };
  }

  const pool = options.pool || getPgPool();

  const typeRes = await pool.query<{ type: string; count: string }>(
    `SELECT type, COUNT(*)::text AS count
     FROM durable_jobs
     WHERE status = 'failed'
     GROUP BY type`
  );

  const byType: Record<string, number> = {};
  let totalFailed = 0;
  for (const row of typeRes.rows) {
    const c = parseInt(row.count, 10) || 0;
    byType[row.type] = c;
    totalFailed += c;
  }

  const reasonRes = await pool.query<{ reason: string | null; count: string }>(
    `SELECT COALESCE(failed_reason, 'Unknown') AS reason, COUNT(*)::text AS count
     FROM durable_jobs
     WHERE status = 'failed'
     GROUP BY COALESCE(failed_reason, 'Unknown')
     ORDER BY count DESC
     LIMIT 5`
  );

  const commonReasons = reasonRes.rows.map((row) => ({
    reason: row.reason || "Unknown",
    count: parseInt(row.count, 10) || 0,
  }));

  return {
    totalFailed,
    byType,
    commonReasons,
  };
}

export async function replayDeadLetterJob(jobId: string, options: { pool?: Pool } = {}): Promise<boolean> {
  if (!isPostgresConfigured() && !options.pool) {
    return false;
  }

  const pool = options.pool || getPgPool();
  const res = await pool.query(
    `UPDATE durable_jobs
     SET status = 'pending',
         attempts = 0,
         failed_reason = NULL,
         lease_id = NULL,
         leased_until = NULL,
         updated_at = NOW()
     WHERE id = $1 AND status = 'failed'`,
    [jobId]
  );

  return (res.rowCount ?? 0) > 0;
}

export async function replayDeadLetterBatch(options: {
  type?: string;
  limit?: number;
  pool?: Pool;
} = {}): Promise<number> {
  if (!isPostgresConfigured() && !options.pool) {
    return 0;
  }

  const pool = options.pool || getPgPool();
  const limit = options.limit ?? 100;

  const res = await pool.query(
    `WITH target_jobs AS (
       SELECT id FROM durable_jobs
       WHERE status = 'failed' AND ($1::varchar IS NULL OR type = $1)
       LIMIT $2
     )
     UPDATE durable_jobs
     SET status = 'pending',
         attempts = 0,
         failed_reason = NULL,
         lease_id = NULL,
         leased_until = NULL,
         updated_at = NOW()
     FROM target_jobs
     WHERE durable_jobs.id = target_jobs.id`,
    [options.type || null, limit]
  );

  return res.rowCount ?? 0;
}
