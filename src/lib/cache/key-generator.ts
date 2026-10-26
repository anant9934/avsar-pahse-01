import { createHash } from "node:crypto";

/**
 * Generate deterministic, normalized cache keys for high-concurrency query caching.
 * Sorts object keys recursively to ensure consistent hashes regardless of argument order.
 */
export function generateCacheKey(namespace: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) {
    return `avsar:${namespace}:all`;
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
    return `avsar:${namespace}:all`;
  }

  const rawJson = JSON.stringify(cleaned);
  // Short queries keep readable string; long queries are hashed
  if (rawJson.length <= 64) {
    const safeStr = rawJson.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `avsar:${namespace}:${safeStr}`;
  }

  const hash = createHash("sha256").update(rawJson).digest("hex").slice(0, 16);
  return `avsar:${namespace}:h_${hash}`;
}
