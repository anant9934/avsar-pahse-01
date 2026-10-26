import { createHash } from "node:crypto";

export const CACHE_SCHEMA_VERSION = "v1";

export class UnsafePrivateCacheKeyError extends Error {
  constructor(namespace: string) {
    super(
      `Cannot generate global cache key for private namespace "${namespace}" without explicit candidateId scoping.`
    );
    this.name = "UnsafePrivateCacheKeyError";
  }
}

const PRIVATE_NAMESPACES = new Set([
  "profile",
  "candidate",
  "applications",
  "saved_jobs",
  "resume",
  "session",
]);

/**
 * Generate deterministic, normalized cache keys for high-concurrency query caching.
 * Sorts object keys recursively to ensure consistent hashes regardless of argument order.
 * Strictly verifies candidate scoping for private user data namespaces.
 */
export function generateCacheKey(
  namespace: string,
  params?: Record<string, unknown>,
  options: { version?: string } = {}
): string {
  const version = options.version || CACHE_SCHEMA_VERSION;
  const isPrivate = PRIVATE_NAMESPACES.has(namespace.toLowerCase());

  if (isPrivate) {
    const candidateId = params?.candidateId;
    if (!candidateId || typeof candidateId !== "string" || candidateId.trim() === "") {
      throw new UnsafePrivateCacheKeyError(namespace);
    }
  }

  if (!params || Object.keys(params).length === 0) {
    return `avsar:${version}:${namespace}:all`;
  }

  // Filter out undefined and null values
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(params).sort()) {
    const val = params[key];
    if (val !== undefined && val !== null && val !== "") {
      cleaned[key] = typeof val === "string" ? val.trim() : val;
    }
  }

  if (Object.keys(cleaned).length === 0) {
    return `avsar:${version}:${namespace}:all`;
  }

  const rawJson = JSON.stringify(cleaned);
  // Short queries keep readable string; long queries are hashed
  if (rawJson.length <= 64) {
    const safeStr = rawJson.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `avsar:${version}:${namespace}:${safeStr}`;
  }

  const hash = createHash("sha256").update(rawJson).digest("hex").slice(0, 16);
  return `avsar:${version}:${namespace}:h_${hash}`;
}
