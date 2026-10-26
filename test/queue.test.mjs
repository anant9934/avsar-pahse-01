import test from "node:test";
import assert from "node:assert/strict";
import { MemoryQueue } from "../src/lib/queue/memory-queue.ts";
import {
  enqueueJob,
  drainQueue,
  getQueueStats,
  resetQueueForTesting,
  registerJobHandler,
} from "../src/lib/queue/index.ts";

test("MemoryQueue: enqueues and completes async jobs", async () => {
  const queue = new MemoryQueue();
  let executed = false;

  queue.registerHandler("test_task", async (job) => {
    assert.equal(job.payload.value, 42);
    executed = true;
  });

  const job = await queue.enqueue("test_task", { value: 42 });
  assert.ok(job.status === "pending" || job.status === "processing");

  await queue.drain(2000);

  assert.equal(executed, true);
  const stats = queue.getStats();
  assert.equal(stats.completedCount, 1);
  assert.equal(stats.pendingCount, 0);
  assert.equal(stats.processingCount, 0);
});

test("MemoryQueue: enforces worker concurrency cap", async () => {
  const queue = new MemoryQueue({ concurrency: 2 });
  let activeConcurrency = 0;
  let maxObservedConcurrency = 0;

  queue.registerHandler("concurrency_task", async () => {
    activeConcurrency++;
    if (activeConcurrency > maxObservedConcurrency) {
      maxObservedConcurrency = activeConcurrency;
    }
    // Simulate slow async task
    await new Promise((r) => setTimeout(r, 40));
    activeConcurrency--;
  });

  // Enqueue 6 simultaneous jobs
  for (let i = 0; i < 6; i++) {
    queue.enqueue("concurrency_task", { i });
  }

  await queue.drain(3000);

  assert.ok(maxObservedConcurrency <= 2, `Concurrency exceeded limit: ${maxObservedConcurrency}`);
  assert.equal(queue.getStats().completedCount, 6);
});

test("MemoryQueue: retries on transient error and recovers", async () => {
  const queue = new MemoryQueue({ maxRetries: 3, backoffMs: 20 });
  let attempts = 0;

  queue.registerHandler("flaky_task", async () => {
    attempts++;
    if (attempts < 2) {
      throw new Error("Temporary network glitch");
    }
  });

  await queue.enqueue("flaky_task", { payload: "data" });
  await queue.drain(2000);

  assert.equal(attempts, 2, "Job should have succeeded on 2nd attempt");
  assert.equal(queue.getStats().completedCount, 1);
  assert.equal(queue.getStats().failedCount, 0);
});

test("MemoryQueue: sends permanently failing job to Dead Letter Queue (DLQ)", async () => {
  const queue = new MemoryQueue({ maxRetries: 2, backoffMs: 10 });
  let attempts = 0;

  queue.registerHandler("poison_task", async () => {
    attempts++;
    throw new Error("Permanent database failure");
  });

  await queue.enqueue("poison_task", { id: "fail" });
  await queue.drain(2000);

  assert.equal(attempts, 2);
  const stats = queue.getStats();
  assert.equal(stats.completedCount, 0);
  assert.equal(stats.failedCount, 1);
  assert.equal(stats.deadLetterCount, 1);

  const dlq = queue.getDeadLetterJobs();
  assert.equal(dlq.length, 1);
  assert.equal(dlq[0].failedReason, "Permanent database failure");
});

test("Unified Queue Facade: routes standard events via singleton", async () => {
  resetQueueForTesting();
  let received = false;

  registerJobHandler("custom_event", async (job) => {
    assert.equal(job.payload.ping, "pong");
    received = true;
  });

  await enqueueJob("custom_event", { ping: "pong" });
  await drainQueue(2000);

  assert.equal(received, true);
  const stats = getQueueStats();
  assert.equal(stats.completedCount, 1);

  resetQueueForTesting();
});
