import crypto from "node:crypto";
import type { Pool } from "pg";
import { getPgPool, isPostgresConfigured, withTransaction } from "../db/postgres.ts";
import type {
  DurableQueueProvider,
  LeasedJob,
  QueueJob,
  JobPriority,
  QueueStats,
} from "./types.ts";

interface DurableJobRow {
  id: string;
  type: string;
  payload: unknown;
  priority: JobPriority;
  status: string;
  attempts: number;
  max_attempts: number;
  lease_id: string | null;
  leased_until: Date | null;
  failed_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export class PostgresDurableQueue implements DurableQueueProvider {
  private pool?: Pool;

  constructor(pool?: Pool) {
    this.pool = pool;
  }

  private getPool(): Pool {
    return this.pool || getPgPool();
  }

  async enqueue<T = unknown>(
    type: string,
    payload: T,
    options: { priority?: JobPriority; maxRetries?: number } = {}
  ): Promise<QueueJob<T>> {
    const id = `job_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const priority = options.priority || "normal";
    const maxRetries = options.maxRetries ?? 3;

    if (!isPostgresConfigured() && !this.pool) {
      // In-memory representation fallback when DB is unconfigured
      return {
        id,
        type,
        payload,
        status: "pending",
        priority,
        attempts: 0,
        maxAttempts: maxRetries,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    const pool = this.getPool();
    const res = await pool.query<DurableJobRow>(
      `INSERT INTO durable_jobs (
         id, type, payload, priority, status, attempts, max_attempts, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'pending', 0, $5, NOW(), NOW())
       RETURNING *`,
      [id, type, JSON.stringify(payload), priority, maxRetries]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      type: row.type,
      payload: row.payload as T,
      status: "pending",
      priority: row.priority,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  async leaseBatch<T = unknown>(
    limit = 10,
    leaseDurationSeconds = 60
  ): Promise<LeasedJob<T>[]> {
    if (!isPostgresConfigured() && !this.pool) {
      return [];
    }

    const leaseId = crypto.randomUUID();

    return await withTransaction<LeasedJob<T>[]>(async (client) => {
      // Lock pending or expired leased jobs using FOR UPDATE SKIP LOCKED
      const selectRes = await client.query<DurableJobRow>(
        `SELECT id, type, payload, priority, status, attempts, max_attempts, created_at, updated_at
         FROM durable_jobs
         WHERE status = 'pending' OR (status = 'leased' AND leased_until < NOW())
         ORDER BY 
           CASE priority 
             WHEN 'high' THEN 1 
             WHEN 'normal' THEN 2 
             WHEN 'low' THEN 3 
             ELSE 4 
           END, 
           created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [limit]
      );

      if (selectRes.rows.length === 0) {
        return [];
      }

      const jobIds = selectRes.rows.map((r) => r.id);

      await client.query(
        `UPDATE durable_jobs
         SET status = 'leased',
             lease_id = $1,
             leased_until = NOW() + ($2 || ' seconds')::interval,
             updated_at = NOW()
         WHERE id = ANY($3::varchar[])`,
        [leaseId, leaseDurationSeconds, jobIds]
      );

      const leasedUntil = new Date(Date.now() + leaseDurationSeconds * 1000);

      return selectRes.rows.map((row) => ({
        id: row.id,
        type: row.type,
        payload: row.payload as T,
        status: "processing",
        priority: row.priority,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: Date.now(),
        leaseId,
        leasedUntil,
      }));
    });
  }

  async ack(jobId: string, leaseId: string): Promise<boolean> {
    if (!isPostgresConfigured() && !this.pool) return true;

    const pool = this.getPool();
    const res = await pool.query(
      `UPDATE durable_jobs
       SET status = 'completed',
           lease_id = NULL,
           leased_until = NULL,
           updated_at = NOW()
       WHERE id = $1 AND lease_id = $2 AND status = 'leased'`,
      [jobId, leaseId]
    );

    return (res.rowCount ?? 0) > 0;
  }

  async nack(jobId: string, leaseId: string, errorReason?: string): Promise<boolean> {
    if (!isPostgresConfigured() && !this.pool) return true;

    const pool = this.getPool();
    const res = await pool.query(
      `UPDATE durable_jobs
       SET attempts = attempts + 1,
           status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
           failed_reason = $3,
           lease_id = NULL,
           leased_until = NULL,
           updated_at = NOW()
       WHERE id = $1 AND lease_id = $2 AND status = 'leased'`,
      [jobId, leaseId, errorReason || null]
    );

    return (res.rowCount ?? 0) > 0;
  }

  async getStats(): Promise<QueueStats> {
    if (!isPostgresConfigured() && !this.pool) {
      return {
        pendingCount: 0,
        processingCount: 0,
        completedCount: 0,
        failedCount: 0,
        deadLetterCount: 0,
      };
    }

    const pool = this.getPool();
    const res = await pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM durable_jobs GROUP BY status`
    );

    let pendingCount = 0;
    let processingCount = 0;
    let completedCount = 0;
    let deadLetterCount = 0;

    for (const row of res.rows) {
      const c = parseInt(row.count, 10) || 0;
      if (row.status === "pending") pendingCount += c;
      else if (row.status === "leased" || row.status === "processing") processingCount += c;
      else if (row.status === "completed") completedCount += c;
      else if (row.status === "failed") deadLetterCount += c;
    }

    return {
      pendingCount,
      processingCount,
      completedCount,
      failedCount: deadLetterCount,
      deadLetterCount,
    };
  }

  async replayDeadLetters(type?: string): Promise<number> {
    if (!isPostgresConfigured() && !this.pool) return 0;

    const pool = this.getPool();
    const res = await pool.query(
      `UPDATE durable_jobs
       SET status = 'pending',
           attempts = 0,
           failed_reason = NULL,
           lease_id = NULL,
           leased_until = NULL,
           updated_at = NOW()
       WHERE status = 'failed' AND ($1::varchar IS NULL OR type = $1)`,
      [type || null]
    );

    return res.rowCount ?? 0;
  }
}
