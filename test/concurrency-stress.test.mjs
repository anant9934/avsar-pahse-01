import test from "node:test";
import assert from "node:assert/strict";
import { MemoryCacheProvider } from "../src/lib/cache/memory-cache.ts";
import { SlidingWindowLimiter } from "../src/lib/ratelimit/sliding-window.ts";
import { MemoryQueue } from "../src/lib/queue/memory-queue.ts";

test("Concurrency Stress: 1,000 parallel requests against cache invoke fetcher exactly once", async () => {
  const cache = new MemoryCacheProvider({ defaultTtlSeconds: 60 });
  let fetcherInvocations = 0;

  const fetcher = async () => {
    fetcherInvocations++;
    // Simulate 20ms database latency
    await new Promise((r) => setTimeout(r, 20));
    return { data: "expensive_payload", timestamp: Date.now() };
  };

  // Launch 1,000 simultaneous promises against the same cache key
  const promises = [];
  for (let i = 0; i < 1000; i++) {
    promises.push(cache.getOrSet("hot_jobs_key", fetcher));
  }

  const results = await Promise.all(promises);

  assert.equal(fetcherInvocations, 1, "Fetcher must execute exactly once under 1000 concurrent requests");
  assert.equal(results.length, 1000);
  assert.equal(results[0].data, "expensive_payload");
  assert.equal(results[999].data, "expensive_payload");
});

test("Concurrency Stress: Rate limiter cleanly evaluates 1,000 requests across partitioned keys", async () => {
  const limiter = new SlidingWindowLimiter();
  const config = { windowMs: 60000, maxRequests: 50 };

  // 10 candidates each making 100 concurrent requests (total 1,000)
  const candidatePromises = [];
  for (let candIdx = 0; candIdx < 10; candIdx++) {
    const candKey = `cand_stress_${candIdx}`;
    for (let req = 0; req < 100; req++) {
      candidatePromises.push(limiter.check(candKey, config));
    }
  }

  const results = await Promise.all(candidatePromises);
  assert.equal(results.length, 1000);

  // For each candidate, exactly 50 requests should be allowed and 50 denied
  const allowed = results.filter((r) => r.allowed).length;
  const denied = results.filter((r) => !r.allowed).length;

  assert.equal(allowed, 500, "Exactly 50 requests allowed per each of 10 candidates (500 total)");
  assert.equal(denied, 500, "Exactly 50 requests denied per each of 10 candidates (500 total)");
});

test("Concurrency Stress: Worker pool drains 1,000 queued jobs with zero loss", async () => {
  const queue = new MemoryQueue({ concurrency: 10, backoffMs: 10 });
  let processedCount = 0;

  queue.registerHandler("stress_task", async () => {
    processedCount++;
  });

  // Enqueue 1,000 jobs with mixed priorities
  for (let i = 0; i < 1000; i++) {
    const priority = i % 3 === 0 ? "high" : i % 2 === 0 ? "normal" : "low";
    queue.enqueue("stress_task", { id: i }, { priority });
  }

  await queue.drain(10000);

  const stats = queue.getStats();
  assert.equal(processedCount, 1000, "All 1,000 jobs must be processed");
  assert.equal(stats.completedCount, 1000);
  assert.equal(stats.pendingCount, 0);
  assert.equal(stats.processingCount, 0);
  assert.equal(stats.failedCount, 0);
});
