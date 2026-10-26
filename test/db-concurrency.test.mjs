import test from "node:test";
import assert from "node:assert/strict";
import { isTransientDatabaseError, executeWithRetry } from "../src/lib/db/postgres.ts";

test("Database Concurrency 1: Transient Error Classification", () => {
  // Retryable transient errors
  assert.equal(isTransientDatabaseError({ code: "57P01", message: "admin shutdown" }), true);
  assert.equal(isTransientDatabaseError({ code: "ECONNRESET", message: "read ECONNRESET" }), true);
  assert.equal(isTransientDatabaseError({ code: "ETIMEDOUT", message: "connect ETIMEDOUT" }), true);
  assert.equal(isTransientDatabaseError(new Error("server closed the connection unexpectedly")), true);
  assert.equal(isTransientDatabaseError(new Error("connection terminated due to connection timeout")), true);

  // Non-transient errors (must fail immediately without retry)
  assert.equal(isTransientDatabaseError(new Error("syntax error at or near 'SELECT'")), false);
  assert.equal(isTransientDatabaseError({ code: "23505", message: "duplicate key value violates unique constraint" }), false);
  assert.equal(isTransientDatabaseError({ code: "42P01", message: "relation 'nonexistent' does not exist" }), false);
  assert.equal(isTransientDatabaseError(null), false);
});

test("Database Concurrency 2: Execute With Retry Recovers on Transient Drops", async () => {
  let attempts = 0;
  const transientError = new Error("connection terminated unexpectedly");

  const result = await executeWithRetry(async () => {
    attempts++;
    if (attempts === 1) {
      throw transientError;
    }
    return { status: "recovered", attempts };
  }, 3, 10);

  assert.equal(attempts, 2);
  assert.equal(result.status, "recovered");
});

test("Database Concurrency 3: Execute With Retry Fails Fast on Non-Transient Errors", async () => {
  let attempts = 0;
  const permanentError = new Error("syntax error at or near 'FORM'");

  await assert.rejects(async () => {
    await executeWithRetry(async () => {
      attempts++;
      throw permanentError;
    }, 3, 10);
  }, /syntax error/);

  // Must not retry non-transient errors
  assert.equal(attempts, 1);
});

test("Database Concurrency 4: Execute With Retry Respects Max Retries Bound", async () => {
  let attempts = 0;
  const transientError = { code: "ECONNRESET", message: "socket hang up" };

  await assert.rejects(async () => {
    await executeWithRetry(async () => {
      attempts++;
      throw transientError;
    }, 2, 10);
  }, (err) => err.code === "ECONNRESET");

  // Initial attempt + 2 retries = 3 total attempts
  assert.equal(attempts, 3);
});
