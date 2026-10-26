/**
 * Types and contracts for Avsar Idempotency Framework
 * 
 * Supports deterministic deduplication of concurrent and retried mutations
 * (e.g. application submission, job bookmarking, resume upload confirmation).
 */

export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord<T = unknown> {
  key: string;
  scope: string;
  candidateId?: string | null;
  payloadHash: string;
  status: IdempotencyStatus;
  responseCode?: number | null;
  responseBody?: T | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface AcquireResult<T = unknown> {
  acquired: boolean;
  existingRecord?: IdempotencyRecord<T> | null;
  mismatch?: boolean;
}

export interface IdempotencyStorage {
  /**
   * Attempts to acquire an idempotency lock for key, scope, and payload hash.
   * If record exists with matching hash and COMPLETED status, returns existing record.
   * If record exists with mismatching hash, returns mismatch: true.
   * If key is already IN_PROGRESS, acquired will be false and lockConflict true.
   */
  acquire<T = unknown>(
    key: string,
    scope: string,
    payloadHash: string,
    candidateId?: string | null,
    ttlSeconds?: number
  ): Promise<AcquireResult<T>>;

  /**
   * Marks key as COMPLETED with status code and cached response body.
   */
  complete<T = unknown>(
    key: string,
    responseCode: number,
    responseBody: T
  ): Promise<void>;

  /**
   * Marks key as FAILED or clears lock on unrecoverable infrastructure failure.
   */
  fail(key: string, errorReason?: string): Promise<void>;

  /**
   * Retrieves an idempotency record by key.
   */
  get<T = unknown>(key: string): Promise<IdempotencyRecord<T> | null>;
}
