import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RedisCacheProvider } from "../src/lib/cache/redis-provider.ts";

describe("RedisCacheProvider with Distributed Invalidation", () => {
  it("operates in resilient fallback mode when unconfigured", async () => {
    const provider = new RedisCacheProvider({ restUrl: "", restToken: "" });
    assert.equal(provider.name, "redis");

    await provider.set("test-key", { value: 42 }, { ttlSeconds: 30 });
    const cached = await provider.get("test-key");
    assert.deepEqual(cached, { value: 42 });

    const deleted = await provider.delete("test-key");
    assert.equal(deleted, true);

    const afterDel = await provider.get("test-key");
    assert.equal(afterDel, null);
  });

  it("coalesces concurrent in-flight requests to eliminate cache stampedes", async () => {
    const provider = new RedisCacheProvider({ restUrl: "", restToken: "" });
    let fetchCount = 0;

    const slowFetcher = async () => {
      fetchCount++;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return { timestamp: Date.now(), data: "computed" };
    };

    // 5 concurrent requests arriving simultaneously for the same cold key
    const promises = Array.from({ length: 5 }, () =>
      provider.getOrSet("stampede-key", slowFetcher, { ttlSeconds: 60 })
    );

    const results = await Promise.all(promises);

    // All callers receive identical data
    for (const res of results) {
      assert.equal(res.data, "computed");
      assert.equal(res.timestamp, results[0].timestamp);
    }

    // Upstream fetcher was invoked exactly once!
    assert.equal(fetchCount, 1);
  });

  it("purges tagged keys in distributed mode", async () => {
    const deletedKeys = [];
    const originalFetch = global.fetch;

    global.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/smembers/")) {
        return {
          ok: true,
          json: async () => ({ result: ["job:1", "job:2"] }),
        };
      }
      if (urlStr.includes("/del/")) {
        deletedKeys.push(urlStr);
        return {
          ok: true,
          json: async () => ({ result: 1 }),
        };
      }
      return { ok: true, json: async () => ({ result: "OK" }) };
    };

    try {
      const provider = new RedisCacheProvider({
        restUrl: "https://mock-redis.upstash.io",
        restToken: "mock-token",
      });

      const purged = await provider.purgeTag("jobs");
      assert.ok(purged >= 2);
      assert.ok(deletedKeys.some((k) => k.includes("job%3A1")));
      assert.ok(deletedKeys.some((k) => k.includes("job%3A2")));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
