import { SlidingWindowLimiter, MemoryRateLimitStore } from "./sliding-window.ts";
import { RedisRateLimitStore } from "./redis-store.ts";
import { resolveClientIp } from "./ip-resolver.ts";
import { getPolicyForPathname } from "./policies.ts";
import type { RateLimitConfig, RateLimitResult } from "./types.ts";

let globalLimiterInstance: SlidingWindowLimiter | null = null;
let isSharedStoreActive = false;

/**
 * Returns the active sliding-window rate limiter singleton.
 * Uses distributed RedisRateLimitStore when Upstash credentials are present;
 * falls back safely to in-memory sliding window when unconfigured.
 */
export function getRateLimiter(): SlidingWindowLimiter {
  if (!globalLimiterInstance) {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const redisStore = new RedisRateLimitStore();
      globalLimiterInstance = new SlidingWindowLimiter(redisStore);
      isSharedStoreActive = true;
    } else {
      globalLimiterInstance = new SlidingWindowLimiter(new MemoryRateLimitStore());
      isSharedStoreActive = false;
    }
  }
  return globalLimiterInstance;
}

/**
 * Checks whether rate limits are globally enforced across instances.
 */
export function isGlobalRateLimitingActive(): boolean {
  getRateLimiter(); // ensures initialized
  return isSharedStoreActive;
}

/**
 * Helper to check an arbitrary identifier (IP, candidateId, apiKey) against a rate policy.
 */
export async function checkRateLimit(
  identifier: string,
  policy: RateLimitConfig
): Promise<RateLimitResult> {
  return getRateLimiter().check(identifier, policy);
}

/**
 * Defensive middleware guard to enforce rate limits on incoming HTTP requests.
 * Returns null if the request is within bounds.
 * Returns a 429 Too Many Requests response with RFC-compliant headers if exceeded.
 */
export async function enforceRateLimit(
  request: Request | { headers: Headers; url: string },
  customPolicy?: RateLimitConfig,
  identifierOverride?: string
): Promise<Response | null> {
  // Allow bypassing rate limits during local automated unit testing if explicitly disabled
  if (process.env.DISABLE_RATE_LIMITING === "true") {
    return null;
  }

  const identifier = identifierOverride || resolveClientIp(request);
  const url = new URL(request.url);
  const policy = customPolicy || getPolicyForPathname(url.pathname);

  const result = await getRateLimiter().check(identifier, policy);
  const scope = isSharedStoreActive ? "global" : "local-degraded";

  if (!result.allowed) {
    return Response.json(
      {
        error: "Too many requests. Please slow down and try again shortly.",
        retryAfter: result.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSeconds),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": String(result.remaining),
          "X-RateLimit-Reset": String(result.resetMs),
          "X-RateLimit-Scope": scope,
        },
      }
    );
  }

  return null;
}

/**
 * Reset singleton rate limiter (useful for unit test isolation)
 */
export function resetRateLimiterForTesting(): void {
  globalLimiterInstance = null;
  isSharedStoreActive = false;
}

export * from "./types.ts";
export * from "./ip-resolver.ts";
export * from "./trusted-proxies.ts";
export * from "./redis-store.ts";
export * from "./sliding-window.ts";
export * from "./policies.ts";
