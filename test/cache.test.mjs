import test from "node:test";
import assert from "node:assert/strict";
import { MemoryCacheProvider } from "../src/lib/cache/memory-cache.ts";
import { generateCacheKey } from "../src/lib/cache/key-generator.ts";
import {
  getCacheManager,
  cacheGet,
  cacheSet,
  cacheDelete,
  cachePurgeTag,
  cacheGetOrSet,
  getCacheStats,
  resetCacheManagerForTesting,
} from "../src/lib/cache/index.ts";

test("Cache Key Generator: generates deterministic canonical keys regardless of param ordering", () => {
  const key1 = generateCacheKey("jobs", { page: 1, limit: 20, q: "engineer", location: "Remote" });
  const key2 = generateCacheKey("jobs", { location: "Remote", q: "engineer", limit: 20, page: 1 });
  assert.equal(key1, key2, "Canonical query sorting should produce identical keys");

  // Undefined and null params should be stripped
  const key3 = generateCacheKey("jobs", { page: 1, limit: 20, q: "engineer", location: "Remote", filter: undefined });
  assert.equal(key1, key3, "Undefined parameters should be excluded from hash calculation");
});

test("MemoryCacheProvider: stores, retrieves, and updates values", async () => {
  const cache = new MemoryCacheProvider({ maxItems: 10, defaultTtlSeconds: 60 });
  await cache.set("test:1", { title: "Software Engineer" });
  
  const val = await cache.get("test:1");
  assert.deepEqual(val, { title: "Software Engineer" });

  const stats = cache.getStats();
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 0);

  const missing = await cache.get("test:nonexistent");
  assert.equal(missing, null);
  assert.equal(cache.getStats().misses, 1);
});

test("MemoryCacheProvider: LRU eviction enforces maximum capacity", async () => {
  const cache = new MemoryCacheProvider({ maxItems: 3 });
  await cache.set("k1", 1);
  await cache.set("k2", 2);
  await cache.set("k3", 3);

  // Access k1 so k2 becomes the least recently used
  await cache.get("k1");

  // Add 4th item, should evict k2
  await cache.set("k4", 4);

  assert.equal(await cache.get("k1"), 1, "k1 should still exist because it was accessed");
  assert.equal(await cache.get("k2"), null, "k2 should have been evicted as LRU");
  assert.equal(await cache.get("k3"), 3, "k3 should still exist");
  assert.equal(await cache.get("k4"), 4, "k4 should exist");
  assert.equal(cache.getStats().evictions, 1);
});

test("MemoryCacheProvider: TTL expiry returns null for expired items", async () => {
  const cache = new MemoryCacheProvider({ defaultTtlSeconds: 1 });
  // Set item with 0.05 second TTL (50ms)
  await cache.set("quick_expire", { data: "ephemeral" }, { ttlSeconds: 0.05 });

  const beforeExpire = await cache.get("quick_expire");
  assert.deepEqual(beforeExpire, { data: "ephemeral" });

  // Wait 70ms for expiration
  await new Promise((resolve) => setTimeout(resolve, 70));

  const afterExpire = await cache.get("quick_expire");
  assert.equal(afterExpire, null, "Item should have expired");
});

test("MemoryCacheProvider: Tag-based purging invalidates tagged entries", async () => {
  const cache = new MemoryCacheProvider();
  await cache.set("job:1", { id: "1" }, { tags: ["jobs", "company:acme"] });
  await cache.set("job:2", { id: "2" }, { tags: ["jobs", "company:globex"] });
  await cache.set("metric:active_users", 42, { tags: ["metrics"] });

  assert.ok(await cache.get("job:1"));
  assert.ok(await cache.get("job:2"));
  assert.ok(await cache.get("metric:active_users"));

  // Purge company:acme tag
  const purgedCompany = await cache.purgeTag("company:acme");
  assert.equal(purgedCompany, 1);
  assert.equal(await cache.get("job:1"), null);
  assert.ok(await cache.get("job:2"));

  // Purge jobs tag
  const purgedJobs = await cache.purgeTag("jobs");
  assert.equal(purgedJobs, 1); // Only job:2 remained
  assert.equal(await cache.get("job:2"), null);

  // Metrics untouched
  assert.equal(await cache.get("metric:active_users"), 42);
});

test("MemoryCacheProvider Singleflight: coalesces concurrent thundering-herd requests into single invocation", async () => {
  const cache = new MemoryCacheProvider();
  let fetcherCallCount = 0;

  const expensiveFetcher = async () => {
    fetcherCallCount++;
    // Simulate slow DB query taking 50ms
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { data: "heavy-query-result", count: fetcherCallCount };
  };

  // Launch 10 simultaneous concurrent requests for the same key
  const promises = Array.from({ length: 10 }).map(() =>
    cache.getOrSet("concurrent:key", expensiveFetcher, { ttlSeconds: 30 })
  );

  const results = await Promise.all(promises);

  // All 10 requests should receive the exact same result
  for (const res of results) {
    assert.deepEqual(res, { data: "heavy-query-result", count: 1 });
  }

  // The underlying database query MUST have been executed exactly once
  assert.equal(fetcherCallCount, 1, "Stampede defense singleflight failed: fetcher was called multiple times!");
});

test("Unified Cache Manager: functional export helpers operate on singleton instance", async () => {
  resetCacheManagerForTesting();
  const manager = getCacheManager();
  assert.ok(manager);

  await cacheSet("global:test", 100);
  assert.equal(await cacheGet("global:test"), 100);

  const orSetValue = await cacheGetOrSet("global:lazy", async () => 200, { tags: ["lazy-tag"] });
  assert.equal(orSetValue, 200);
  assert.equal(await cacheGet("global:lazy"), 200);

  const purgedCount = await cachePurgeTag("lazy-tag");
  assert.equal(purgedCount, 1);
  assert.equal(await cacheGet("global:lazy"), null);

  const deleted = await cacheDelete("global:test");
  assert.equal(deleted, true);
  assert.equal(await cacheGet("global:test"), null);

  const stats = getCacheStats();
  assert.ok(typeof stats.itemCount === "number");

  resetCacheManagerForTesting();
});
