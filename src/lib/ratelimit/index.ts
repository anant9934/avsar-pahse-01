import { NextResponse, type NextRequest } from "next/server";
import { SlidingWindowLimiter, MemoryRateLimitStore } from "./sliding-window.ts";
import { resolveClientIp } from "./ip-resolver.ts";
import { getPolicyForPathname } from "./policies.ts";
import type { RateLimitConfig, RateLimitResult } from "./types.ts";

let globalLimiterInstance: SlidingWindowLimiter | null = null;

/**
 * Returns the active sliding-window rate limiter singleton.
 */
export function getRateLimiter(): SlidingWindowLimiter {
  if (!globalLimiterInstance) {
    globalLimiterInstance = new SlidingWindowLimiter(new MemoryRateLimitStore());
  }
  return globalLimiterInstance;
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
  request: Request | NextRequest,
  customPolicy?: RateLimitConfig
): Promise<NextResponse | null> {
  // Allow bypassing rate limits during local automated unit testing if explicitly disabled
  if (process.env.DISABLE_RATE_LIMITING === "true") {
    return null;
  }

  const clientIp = resolveClientIp(request);
  const url = new URL(request.url);
  const policy = customPolicy || getPolicyForPathname(url.pathname);

  const result = await getRateLimiter().check(clientIp, policy);

  if (!result.allowed) {
    return NextResponse.json(
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
}

export * from "./types.ts";
export * from "./ip-resolver.ts";
export * from "./sliding-window.ts";
export * from "./policies.ts";
