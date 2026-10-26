import test from "node:test";
import assert from "node:assert/strict";
import {
  LoadShedder,
  LoadSheddingError,
} from "../src/lib/circuit-breaker/load-shedder.ts";

test("LoadShedder: admits all priorities when under low threshold", async () => {
  const shedder = new LoadShedder({
    maxConcurrency: 10,
    lowPriorityThresholdPercent: 50, // 5
    standardPriorityThresholdPercent: 80, // 8
  });

  const p1 = shedder.acquire("low");
  const p2 = shedder.acquire("standard");
  const p3 = shedder.acquire("critical");

  assert.equal(p1.allowed, true);
  assert.equal(p2.allowed, true);
  assert.equal(p3.allowed, true);

  p1.release();
  p2.release();
  p3.release();

  assert.equal(shedder.getMetrics().activeConcurrency, 0);
});

test("LoadShedder: sheds low priority requests once low threshold is exceeded", () => {
  const shedder = new LoadShedder({
    maxConcurrency: 10,
    lowPriorityThresholdPercent: 50, // 5
    standardPriorityThresholdPercent: 80, // 8
  });

  const permits = [];
  for (let i = 0; i < 5; i++) {
    permits.push(shedder.acquire("standard"));
  }

  assert.equal(shedder.getMetrics().activeConcurrency, 5);

  // Now low priority request should be shed
  const lowPermit = shedder.acquire("low");
  assert.equal(lowPermit.allowed, false, "Low priority request should be shed at 50% capacity");

  // Standard and critical priority should still be allowed
  const stdPermit = shedder.acquire("standard");
  assert.equal(stdPermit.allowed, true, "Standard priority request should still be allowed");
  permits.push(stdPermit);

  // Clean up
  permits.forEach((p) => p.release());
  assert.equal(shedder.getMetrics().activeConcurrency, 0);
});

test("LoadShedder: sheds standard priority requests once standard threshold is exceeded", () => {
  const shedder = new LoadShedder({
    maxConcurrency: 10,
    lowPriorityThresholdPercent: 50,
    standardPriorityThresholdPercent: 80, // 8
  });

  const permits = [];
  for (let i = 0; i < 8; i++) {
    permits.push(shedder.acquire("critical"));
  }

  assert.equal(shedder.getMetrics().activeConcurrency, 8);

  // Standard should be shed at 80%
  const stdPermit = shedder.acquire("standard");
  assert.equal(stdPermit.allowed, false, "Standard priority request should be shed at 80% capacity");

  // Critical must still be allowed
  const critPermit = shedder.acquire("critical");
  assert.equal(critPermit.allowed, true, "Critical priority request should be admitted");
  permits.push(critPermit);

  permits.forEach((p) => p.release());
});

test("LoadShedder: execute invokes fallback or throws LoadSheddingError when shed", async () => {
  const shedder = new LoadShedder({
    maxConcurrency: 1,
    lowPriorityThresholdPercent: 0, // Shed all low priority immediately
  });

  // Acquire the only slot
  const p1 = shedder.acquire("critical");

  // Executing low priority with fallback
  const result = await shedder.execute(
    "low",
    async () => "real result",
    async () => "degraded fallback"
  );
  assert.equal(result, "degraded fallback");

  // Executing without fallback should throw LoadSheddingError
  await assert.rejects(
    async () => {
      await shedder.execute("low", async () => "real result");
    },
    (err) => err instanceof LoadSheddingError
  );

  p1.release();
});
