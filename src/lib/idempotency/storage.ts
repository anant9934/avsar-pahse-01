import { query, withTransaction, isPostgresConfigured } from "../db/postgres.ts";
import type {
  AcquireResult,
  IdempotencyRecord,
  IdempotencyStorage,
  IdempotencyStatus,
} from "./types.ts";

interface IdempotencyRow {
  key: string;
  scope: string;
  candidate_id: string | null;
  payload_hash: string;
  status: string;
  response_code: number | null;
  response_body: unknown | null;
  created_at: Date;
  expires_at: Date;
}

function mapRow<T>(row: IdempotencyRow): IdempotencyRecord<T> {
  return {
    key: row.key,
    scope: row.scope,
    candidateId: row.candidate_id,
    payloadHash: row.payload_hash,
    status: row.status as IdempotencyStatus,
    responseCode: row.response_code,
    responseBody: row.response_body as T | null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export class PostgresIdempotencyStorage implements IdempotencyStorage {
  async acquire<T = unknown>(
    key: string,
    scope: string,
    payloadHash: string,
    candidateId?: string | null,
    ttlSeconds = 86400
  ): Promise<AcquireResult<T>> {
    if (!isPostgresConfigured()) {
      return { acquired: true };
    }

    return await withTransaction<AcquireResult<T>>(async (client) => {
      // 1. Check existing unexpired key with row lock
      const existingRes = await client.query<IdempotencyRow>(
        `SELECT key, scope, candidate_id, payload_hash, status, response_code, response_body, created_at, expires_at
         FROM idempotency_keys
         WHERE key = $1 FOR UPDATE`,
        [key]
      );

      const existing = existingRes.rows[0];
      const now = new Date();

      if (existing) {
        const isExpired = new Date(existing.expires_at) <= now;

        if (!isExpired) {
          // Verify payload hash integrity
          if (existing.payload_hash !== payloadHash) {
            return {
              acquired: false,
              existingRecord: mapRow<T>(existing),
              mismatch: true,
            };
          }

          if (existing.status === "COMPLETED") {
            return {
              acquired: false,
              existingRecord: mapRow<T>(existing),
              mismatch: false,
            };
          }

          if (existing.status === "IN_PROGRESS") {
            // Concurrent request still processing
            return {
              acquired: false,
              existingRecord: mapRow<T>(existing),
              mismatch: false,
            };
          }
        }

        // If expired or failed, overwrite lock
        await client.query(
          `UPDATE idempotency_keys
           SET scope = $2, candidate_id = $3, payload_hash = $4, status = 'IN_PROGRESS',
               response_code = NULL, response_body = NULL, created_at = NOW(),
               expires_at = NOW() + ($5 || ' seconds')::interval
           WHERE key = $1`,
          [key, scope, candidateId || null, payloadHash, ttlSeconds]
        );

        return { acquired: true };
      }

      // 2. Insert new idempotency key
      await client.query(
        `INSERT INTO idempotency_keys (
           key, scope, candidate_id, payload_hash, status, created_at, expires_at
         ) VALUES ($1, $2, $3, $4, 'IN_PROGRESS', NOW(), NOW() + ($5 || ' seconds')::interval)`,
        [key, scope, candidateId || null, payloadHash, ttlSeconds]
      );

      return { acquired: true };
    });
  }

  async complete<T = unknown>(
    key: string,
    responseCode: number,
    responseBody: T
  ): Promise<void> {
    if (!isPostgresConfigured()) return;

    await query(
      `UPDATE idempotency_keys
       SET status = 'COMPLETED', response_code = $2, response_body = $3
       WHERE key = $1`,
      [key, responseCode, JSON.stringify(responseBody)]
    );
  }

  async fail(key: string): Promise<void> {
    if (!isPostgresConfigured()) return;

    await query(
      `UPDATE idempotency_keys
       SET status = 'FAILED'
       WHERE key = $1`,
      [key]
    );
  }

  async get<T = unknown>(key: string): Promise<IdempotencyRecord<T> | null> {
    if (!isPostgresConfigured()) return null;

    const res = await query<IdempotencyRow>(
      `SELECT key, scope, candidate_id, payload_hash, status, response_code, response_body, created_at, expires_at
       FROM idempotency_keys
       WHERE key = $1`,
      [key]
    );

    if (res.rows.length === 0) return null;
    return mapRow<T>(res.rows[0]);
  }
}
