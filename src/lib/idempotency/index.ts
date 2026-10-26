import { isPostgresConfigured } from "../db/postgres.ts";
import { computePayloadHash } from "./fingerprint.ts";
import { MemoryIdempotencyStorage } from "./memory-storage.ts";
import { PostgresIdempotencyStorage } from "./storage.ts";
import type { IdempotencyStorage, IdempotencyRecord } from "./types.ts";

export * from "./types.ts";
export * from "./fingerprint.ts";
export * from "./memory-storage.ts";
export * from "./storage.ts";

export class IdempotencyConflictError extends Error {
  constructor(message = "A mutation with this Idempotency-Key is currently in progress.") {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export class IdempotencyMismatchError extends Error {
  constructor(message = "Idempotency-Key previously used with a different request payload.") {
    super(message);
    this.name = "IdempotencyMismatchError";
  }
}

let activeStorage: IdempotencyStorage | null = null;

export function getIdempotencyStorage(): IdempotencyStorage {
  if (activeStorage) return activeStorage;

  if (isPostgresConfigured()) {
    activeStorage = new PostgresIdempotencyStorage();
  } else {
    activeStorage = new MemoryIdempotencyStorage();
  }

  return activeStorage;
}

export function setIdempotencyStorageForTesting(storage: IdempotencyStorage | null): void {
  activeStorage = storage;
}

export interface IdempotencyExecutionResult<T> {
  replayed: boolean;
  status: number;
  body: T;
}

/**
 * Executes a state-mutating operation protected by an idempotency key.
 * If the key was previously executed with identical payload, replays the cached response.
 * If concurrent execution is detected or payload hash mismatches, raises or handles gracefully.
 */
export async function withIdempotency<T = unknown>(params: {
  key?: string | null;
  scope: string;
  payload: unknown;
  candidateId?: string | null;
  ttlSeconds?: number;
  operation: () => Promise<{ status: number; body: T }>;
}): Promise<IdempotencyExecutionResult<T>> {
  const { key, scope, payload, candidateId, ttlSeconds = 86400, operation } = params;

  // If no idempotency key was supplied by client, execute normally without caching
  if (!key || typeof key !== "string" || key.trim() === "") {
    const res = await operation();
    return { replayed: false, status: res.status, body: res.body };
  }

  const cleanKey = key.trim();
  const payloadHash = computePayloadHash(payload);
  const storage = getIdempotencyStorage();

  const acquireResult = await storage.acquire<T>(
    cleanKey,
    scope,
    payloadHash,
    candidateId,
    ttlSeconds
  );

  if (!acquireResult.acquired) {
    if (acquireResult.mismatch) {
      throw new IdempotencyMismatchError();
    }

    const existing = acquireResult.existingRecord;
    if (existing && existing.status === "COMPLETED") {
      return {
        replayed: true,
        status: existing.responseCode ?? 200,
        body: existing.responseBody as T,
      };
    }

    if (existing && existing.status === "IN_PROGRESS") {
      throw new IdempotencyConflictError();
    }
  }

  // Acquired lock: execute operation
  try {
    const result = await operation();

    // Cache successful or client-error responses; don't cache 5xx server errors
    if (result.status < 500) {
      await storage.complete(cleanKey, result.status, result.body);
    } else {
      await storage.fail(cleanKey, `Server returned ${result.status}`);
    }

    return {
      replayed: false,
      status: result.status,
      body: result.body,
    };
  } catch (err) {
    await storage.fail(cleanKey, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
