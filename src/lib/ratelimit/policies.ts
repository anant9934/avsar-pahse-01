import type { RateLimitConfig } from "./types.ts";

/**
 * Enterprise Route Rate-Limiting Policies for 1,000 Concurrent Active Users.
 * Calibrated against typical human browsing speeds and automated attack patterns.
 */
export const RATE_LIMIT_POLICIES = {
  /** Authentication & OAuth callback endpoints (prevents credential stuffing & replay attacks) */
  auth: {
    windowMs: 60 * 1000,
    maxRequests: 15,
    prefix: "rl:auth",
  } satisfies RateLimitConfig,

  /** Public job listing queries and search endpoints */
  search: {
    windowMs: 60 * 1000,
    maxRequests: 120,
    prefix: "rl:search",
  } satisfies RateLimitConfig,

  /** Candidate job application submissions (prevents automated bot flooding) */
  applications: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    prefix: "rl:app",
  } satisfies RateLimitConfig,

  /** Resume document uploads (protects object storage compute and upload bandwidth) */
  resumes: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    prefix: "rl:resume",
  } satisfies RateLimitConfig,

  /** Admin and metric management endpoints */
  admin: {
    windowMs: 60 * 1000,
    maxRequests: 40,
    prefix: "rl:admin",
  } satisfies RateLimitConfig,

  /** Fallback general API rate limit */
  default: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    prefix: "rl:def",
  } satisfies RateLimitConfig,
};

/**
 * Matches an incoming request pathname to its specific rate limit policy.
 */
export function getPolicyForPathname(pathname: string): RateLimitConfig {
  if (pathname.startsWith("/api/auth")) {
    return RATE_LIMIT_POLICIES.auth;
  }
  if (pathname.startsWith("/api/resumes")) {
    return RATE_LIMIT_POLICIES.resumes;
  }
  if (pathname.startsWith("/api/applications")) {
    return RATE_LIMIT_POLICIES.applications;
  }
  if (pathname.startsWith("/api/admin")) {
    return RATE_LIMIT_POLICIES.admin;
  }
  if (pathname.startsWith("/api/jobs")) {
    return RATE_LIMIT_POLICIES.search;
  }
  return RATE_LIMIT_POLICIES.default;
}
