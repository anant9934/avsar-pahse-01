import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  computePayloadHash,
  MemoryIdempotencyStorage,
  withIdempotency,
  setIdempotencyStorageForTesting,
  IdempotencyMismatchError,
  IdempotencyConflictError,
} from "../src/lib/idempotency/index.ts";

describe("Idempotency Framework", () => {
  let memoryStorage;

  beforeEach(() => {
    memoryStorage = new MemoryIdempotencyStorage();
    setIdempotencyStorageForTesting(memoryStorage);
  });

  describe("Payload Fingerprinting", () => {
    it("produces identical hashes regardless of object key order", () => {
      const payloadA = { jobId: "job-123", candidateId: "cand-456", details: { foo: 1, bar: 2 } };
      const payloadB = { candidateId: "cand-456", details: { bar: 2, foo: 1 }, jobId: "job-123" };

      const hashA = computePayloadHash(payloadA);
      const hashB = computePayloadHash(payloadB);

      assert.equal(hashA, hashB);
      assert.equal(hashA.length, 64);
    });

    it("produces different hashes for different payloads", () => {
      const hash1 = computePayloadHash({ amount: 100 });
      const hash2 = computePayloadHash({ amount: 200 });
      assert.notEqual(hash1, hash2);
    });

    it("handles null, undefined, strings, and arrays", () => {
      assert.equal(typeof computePayloadHash(null), "string");
      assert.equal(typeof computePayloadHash(undefined), "string");
      assert.equal(typeof computePayloadHash("test-payload"), "string");
      assert.equal(typeof computePayloadHash([1, 2, 3]), "string");
    });
  });

  describe("withIdempotency Execution", () => {
    it("executes operation normally when no key is provided", async () => {
      let callCount = 0;
      const res = await withIdempotency({
        scope: "test",
        payload: { x: 1 },
        operation: async () => {
          callCount++;
          return { status: 200, body: { success: true } };
        },
      });

      assert.equal(res.replayed, false);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { success: true });
      assert.equal(callCount, 1);
    });

    it("replays cached response on duplicate request with same key", async () => {
      let callCount = 0;
      const op = async () => {
        callCount++;
        return { status: 201, body: { applicationId: `app-${callCount}` } };
      };

      const res1 = await withIdempotency({
        key: "idem-key-1",
        scope: "applications",
        payload: { jobId: "job-1" },
        operation: op,
      });

      assert.equal(res1.replayed, false);
      assert.equal(res1.status, 201);
      assert.deepEqual(res1.body, { applicationId: "app-1" });
      assert.equal(callCount, 1);

      // Second identical call
      const res2 = await withIdempotency({
        key: "idem-key-1",
        scope: "applications",
        payload: { jobId: "job-1" },
        operation: op,
      });

      assert.equal(res2.replayed, true);
      assert.equal(res2.status, 201);
      assert.deepEqual(res2.body, { applicationId: "app-1" });
      assert.equal(callCount, 1, "Operation should not be invoked twice");
    });

    it("throws IdempotencyMismatchError if payload differs for same key", async () => {
      await withIdempotency({
        key: "idem-key-mismatch",
        scope: "applications",
        payload: { jobId: "job-A" },
        operation: async () => ({ status: 201, body: { ok: true } }),
      });

      await assert.rejects(
        async () => {
          await withIdempotency({
            key: "idem-key-mismatch",
            scope: "applications",
            payload: { jobId: "job-B" },
            operation: async () => ({ status: 201, body: { ok: true } }),
          });
        },
        (err) => err instanceof IdempotencyMismatchError
      );
    });

    it("throws IdempotencyConflictError if previous request is still IN_PROGRESS", async () => {
      // Simulate concurrent in-flight acquisition
      await memoryStorage.acquire("idem-lock-1", "test", computePayloadHash({ foo: "bar" }));

      await assert.rejects(
        async () => {
          await withIdempotency({
            key: "idem-lock-1",
            scope: "test",
            payload: { foo: "bar" },
            operation: async () => ({ status: 200, body: {} }),
          });
        },
        (err) => err instanceof IdempotencyConflictError
      );
    });

    it("marks status as FAILED and allows retry if operation throws or returns 500", async () => {
      let attempts = 0;
      const failingOp = async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("Temporary DB glitch");
        }
        return { status: 200, body: { recovered: true } };
      };

      await assert.rejects(async () => {
        await withIdempotency({
          key: "idem-retry-1",
          scope: "test",
          payload: { a: 1 },
          operation: failingOp,
        });
      });

      // Status should be FAILED, re-attempt should succeed
      const retryRes = await withIdempotency({
        key: "idem-retry-1",
        scope: "test",
        payload: { a: 1 },
        operation: failingOp,
      });

      assert.equal(retryRes.status, 200);
      assert.deepEqual(retryRes.body, { recovered: true });
      assert.equal(attempts, 2);
    });
  });
});
