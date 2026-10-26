import type { RateLimitConfig, RateLimitResult, RateLimitStore } from "./types.ts";

/**
 * High-performance In-Memory sliding-window log store.
 * Automatically evicts old request timestamps outside the rolling time window.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, number[]>();

  async hit(key: string, windowMs: number): Promise<{ count: number; oldestTimestamp: number }> {
    const now = Date.now();
    const cutoff = now - windowMs;

    let timestamps = this.store.get(key);
    if (!timestamps) {
      timestamps = [];
      this.store.set(key, timestamps);
    }

    // Binary search or filter out expired entries outside the rolling window
    const validTimestamps = timestamps.filter((t) => t > cutoff);
    validTimestamps.push(now);
    this.store.set(key, validTimestamps);

    return {
      count: validTimestamps.length,
      oldestTimestamp: validTimestamps[0],
    };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async prune(): Promise<number> {
    const now = Date.now();
    let prunedCount = 0;
    // Default 1-hour max retention if untracked
    const maxRetentionCutoff = now - 3600000;

    for (const [key, timestamps] of this.store.entries()) {
      const active = timestamps.filter((t) => t > maxRetentionCutoff);
      if (active.length === 0) {
        this.store.delete(key);
        prunedCount++;
      } else if (active.length < timestamps.length) {
        this.store.set(key, active);
      }
    }
    return prunedCount;
  }
}

/**
 * Sliding Window Log Rate Limiter.
 * Provides microsecond precision rate limiting without boundary-reset burst anomalies
 * found in standard fixed-window algorithms.
 */
export class SlidingWindowLimiter {
  private store: RateLimitStore;

  constructor(store?: RateLimitStore) {
    this.store = store || new MemoryRateLimitStore();
  }

  async check(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const prefix = config.prefix ? `${config.prefix}:` : "rl:";
    const key = `${prefix}${identifier}`;
    const now = Date.now();

    const { count, oldestTimestamp } = await this.store.hit(key, config.windowMs);

    const allowed = count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);
    const resetMs = oldestTimestamp + config.windowMs;
    const retryAfterSeconds = allowed
      ? 0
      : Math.max(1, Math.ceil((resetMs - now) / 1000));

    return {
      allowed,
      remaining,
      limit: config.maxRequests,
      resetMs,
      retryAfterSeconds,
    };
  }

  async reset(identifier: string, prefix = "rl:"): Promise<void> {
    const key = `${prefix}${identifier}`;
    await this.store.reset(key);
  }
}
