import { createHash } from 'crypto';

/**
 * Normalizes an arbitrary value into a deterministic JSON-string representation
 * with recursively sorted object keys.
 */
export function canonicalizeValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }

  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const sortedObj: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    if (record[key] !== undefined) {
      sortedObj[key] = canonicalizeValue(record[key]);
    }
  }

  return sortedObj;
}

/**
 * Computes a deterministic SHA-256 hash of a payload for idempotency verification.
 */
export function computePayloadHash(payload: unknown): string {
  if (payload === undefined || payload === null) {
    return createHash('sha256').update('').digest('hex');
  }

  if (typeof payload === 'string') {
    return createHash('sha256').update(payload.trim()).digest('hex');
  }

  const canonical = canonicalizeValue(payload);
  const jsonStr = JSON.stringify(canonical);
  return createHash('sha256').update(jsonStr).digest('hex');
}
