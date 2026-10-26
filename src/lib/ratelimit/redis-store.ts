import type { RateLimitStore } from "./types.ts";
import { MemoryRateLimitStore } from "./sliding-window.ts";

/**
 * Upstash Redis-backed atomic sliding-window rate limit store.
 * Uses Redis Sorted Sets (ZSET) to maintain sub-millisecond precision across
 * multiple serverless instances without boundary-reset race conditions.
 * 
 * Falls back safely to in-memory sliding window when Redis is unconfigured or unreachable.
 */
export class RedisRateLimitStore implements RateLimitStore {
  private fallbackMemory: MemoryRateLimitStore;
  private isConfigured = false;
  private restUrl?: string;
  private restToken?: string;

  constructor(options?: { restUrl?: string; restToken?: string }) {
    this.fallbackMemory = new MemoryRateLimitStore();
    this.restUrl = options?.restUrl || process.env.UPSTASH_REDIS_REST_URL;
    this.restToken = options?.restToken || process.env.UPSTASH_REDIS_REST_TOKEN;
    this.isConfigured = Boolean(this.restUrl && this.restToken);
  }

  isSharedProviderActive(): boolean {
    return this.isConfigured;
  }

  async hit(key: string, windowMs: number): Promise<{ count: number; oldestTimestamp: number }> {
    const now = Date.now();
    const cutoff = now - windowMs;

    if (!this.isConfigured || !this.restUrl || !this.restToken) {
      return this.fallbackMemory.hit(key, windowMs);
    }

    const memberId = `${now}:${Math.random().toString(36).slice(2, 8)}`;
    const expireSeconds = Math.ceil(windowMs / 1000) + 10;

    // Upstash REST Pipeline: [ZREMRANGEBYSCORE, ZADD, ZCARD, ZRANGE, EXPIRE]
    const pipeline = [
      ["ZREMRANGEBYSCORE", key, "0", String(cutoff)],
      ["ZADD", key, String(now), memberId],
      ["ZCARD", key],
      ["ZRANGE", key, "0", "0", "WITHSCORES"],
      ["EXPIRE", key, String(expireSeconds)],
    ];

    try {
      const res = await fetch(`${this.restUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.restToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pipeline),
      });

      if (!res.ok) {
        throw new Error(`Upstash pipeline returned HTTP ${res.status}`);
      }

      const results = (await res.json()) as Array<{ result: unknown }>;
      // results[2] is ZCARD count
      const count = (results[2]?.result as number) || 1;

      // results[3] is ZRANGE [member, score]
      const rangeResult = (results[3]?.result as string[]) || [];
      const oldestScore = rangeResult[1] ? parseInt(rangeResult[1], 10) : now;

      return {
        count,
        oldestTimestamp: isNaN(oldestScore) ? now : oldestScore,
      };
    } catch (err) {
      console.warn("[Redis RateLimit Fallback to Memory]:", err);
      return this.fallbackMemory.hit(key, windowMs);
    }
  }

  async reset(key: string): Promise<void> {
    await this.fallbackMemory.reset(key);

    if (!this.isConfigured || !this.restUrl || !this.restToken) {
      return;
    }

    try {
      await fetch(`${this.restUrl}/del/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${this.restToken}` },
      });
    } catch (err) {
      console.warn("[Redis RateLimit Reset Warning]:", err);
    }
  }

  async prune(): Promise<number> {
    return this.fallbackMemory.prune();
  }
}
