/**
 * High-concurrency rate limiting interfaces and configuration types.
 */

export interface RateLimitConfig {
  /** Time window in milliseconds (e.g. 60000 for 1 minute) */
  windowMs: number;
  /** Maximum number of allowed requests in the time window */
  maxRequests: number;
  /** Namespace prefix for rate-limiting keys */
  prefix?: string;
}

export interface RateLimitResult {
  /** Whether the request is permitted within current rate limit quota */
  allowed: boolean;
  /** Remaining permitted requests in the active window */
  remaining: number;
  /** Maximum quota ceiling configured for the window */
  limit: number;
  /** Unix timestamp in milliseconds when the current window resets */
  resetMs: number;
  /** Suggested HTTP Retry-After header value in integer seconds */
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  /**
   * Records a request hit and returns current count and oldest timestamp within the window
   */
  hit(key: string, windowMs: number): Promise<{ count: number; oldestTimestamp: number }>;
  /**
   * Resets rate limit counters for a specific key (e.g. after successful CAPTCHA/2FA)
   */
  reset(key: string): Promise<void>;
  /**
   * Cleans up expired rate-limit records
   */
  prune(): Promise<number>;
}
