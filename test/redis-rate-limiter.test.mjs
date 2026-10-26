import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RedisRateLimitStore } from "../src/lib/ratelimit/redis-store.ts";
import { SlidingWindowLimiter } from "../src/lib/ratelimit/sliding-window.ts";

describe("Redis Distributed Rate Limiter Store", () => {
  it("operates in resilient in-memory fallback mode when unconfigured", async () => {
    const store = new RedisRateLimitStore({ restUrl: "", restToken: "" });
    assert.equal(store.isSharedProviderActive(), false);

    const hit1 = await store.hit("client-1", 60000);
    assert.equal(hit1.count, 1);

    const hit2 = await store.hit("client-1", 60000);
    assert.equal(hit2.count, 2);

    await store.reset("client-1");
    const hit3 = await store.hit("client-1", 60000);
    assert.equal(hit3.count, 1);
  });

  it("executes pipeline against configured Upstash REST endpoint", async () => {
    let pipelineBody = null;
    const originalFetch = global.fetch;

    global.fetch = async (url, options) => {
      pipelineBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => [
          { result: 0 }, // ZREMRANGEBYSCORE
          { result: 1 }, // ZADD
          { result: 3 }, // ZCARD
          { result: ["member1", "1700000000000"] }, // ZRANGE
          { result: 1 }, // EXPIRE
        ],
      };
    };

    try {
      const store = new RedisRateLimitStore({
        restUrl: "https://mock-redis.upstash.io",
        restToken: "mock-token",
      });
      assert.equal(store.isSharedProviderActive(), true);

      const hit = await store.hit("test-key", 60000);

      assert.equal(hit.count, 3);
      assert.equal(hit.oldestTimestamp, 1700000000000);
      assert.ok(Array.isArray(pipelineBody));
      assert.equal(pipelineBody.length, 5);
      assert.equal(pipelineBody[0][0], "ZREMRANGEBYSCORE");
      assert.equal(pipelineBody[1][0], "ZADD");
      assert.equal(pipelineBody[2][0], "ZCARD");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("integrates with SlidingWindowLimiter for distributed policy enforcement", async () => {
    const originalFetch = global.fetch;
    let requestCount = 0;

    global.fetch = async () => {
      requestCount++;
      return {
        ok: true,
        json: async () => [
          { result: 0 },
          { result: 1 },
          { result: requestCount },
          { result: ["member", String(Date.now() - 5000)] },
          { result: 1 },
        ],
      };
    };

    try {
      const store = new RedisRateLimitStore({
        restUrl: "https://mock-redis.upstash.io",
        restToken: "mock-token",
      });
      const limiter = new SlidingWindowLimiter(store);

      const policy = { windowMs: 60000, maxRequests: 2 };

      const res1 = await limiter.check("cand-test", policy);
      assert.equal(res1.allowed, true);
      assert.equal(res1.remaining, 1);

      const res2 = await limiter.check("cand-test", policy);
      assert.equal(res2.allowed, true);
      assert.equal(res2.remaining, 0);

      const res3 = await limiter.check("cand-test", policy);
      assert.equal(res3.allowed, false);
      assert.ok(res3.retryAfterSeconds > 0);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
