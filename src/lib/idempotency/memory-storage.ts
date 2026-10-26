import type {
  AcquireResult,
  IdempotencyRecord,
  IdempotencyStorage,
} from "./types.ts";

export class MemoryIdempotencyStorage implements IdempotencyStorage {
  private records = new Map<string, IdempotencyRecord<unknown>>();

  async acquire<T = unknown>(
    key: string,
    scope: string,
    payloadHash: string,
    candidateId?: string | null,
    ttlSeconds = 86400
  ): Promise<AcquireResult<T>> {
    const existing = this.records.get(key);
    const now = new Date();

    if (existing) {
      const isExpired = existing.expiresAt <= now;
      if (!isExpired) {
        if (existing.payloadHash !== payloadHash) {
          return {
            acquired: false,
            existingRecord: existing as IdempotencyRecord<T>,
            mismatch: true,
          };
        }

        return {
          acquired: false,
          existingRecord: existing as IdempotencyRecord<T>,
          mismatch: false,
        };
      }
    }

    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const newRecord: IdempotencyRecord<T> = {
      key,
      scope,
      candidateId: candidateId || null,
      payloadHash,
      status: "IN_PROGRESS",
      responseCode: null,
      responseBody: null,
      createdAt: now,
      expiresAt,
    };

    this.records.set(key, newRecord as IdempotencyRecord<unknown>);
    return { acquired: true };
  }

  async complete<T = unknown>(
    key: string,
    responseCode: number,
    responseBody: T
  ): Promise<void> {
    const record = this.records.get(key);
    if (record) {
      record.status = "COMPLETED";
      record.responseCode = responseCode;
      record.responseBody = responseBody;
    }
  }

  async fail(key: string): Promise<void> {
    const record = this.records.get(key);
    if (record) {
      record.status = "FAILED";
    }
  }

  async get<T = unknown>(key: string): Promise<IdempotencyRecord<T> | null> {
    const record = this.records.get(key);
    if (!record) return null;
    if (record.expiresAt <= new Date()) {
      this.records.delete(key);
      return null;
    }
    return record as IdempotencyRecord<T>;
  }

  clear(): void {
    this.records.clear();
  }
}
