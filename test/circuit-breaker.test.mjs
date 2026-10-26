import test from "node:test";
import assert from "node:assert/strict";
import { CircuitBreaker } from "../src/lib/circuit-breaker/circuit-breaker.ts";
import {
  executeWithBreaker,
  getCircuitState,
  getCircuitStats,
  resetCircuit,
  CircuitBreakerOpenError,
} from "../src/lib/circuit-breaker/index.ts";

test("CircuitBreaker: allows normal execution when state is closed", async () => {
  const breaker = new CircuitBreaker("test_closed");
  const result = await breaker.execute(async () => 100);
  assert.equal(result, 100);
  assert.equal(breaker.getState(), "closed");
  assert.equal(breaker.getStats().totalSuccesses, 1);
});

test("CircuitBreaker: trips to open after consecutive failures reach threshold", async () => {
  const breaker = new CircuitBreaker("test_tripping", { failureThreshold: 3, recoveryTimeMs: 100 });

  const failingCall = async () => {
    throw new Error("Downstream connection timeout");
  };

  // Failures 1 & 2: still closed
  await assert.rejects(() => breaker.execute(failingCall));
  await assert.rejects(() => breaker.execute(failingCall));
  assert.equal(breaker.getState(), "closed");

  // Failure 3: trips breaker to open
  await assert.rejects(() => breaker.execute(failingCall));
  assert.equal(breaker.getState(), "open");

  // Call 4: fast-fails immediately with CircuitBreakerOpenError without invoking target
  let targetInvoked = false;
  await assert.rejects(
    () =>
      breaker.execute(async () => {
        targetInvoked = true;
        return "should-not-run";
      }),
    (err) => {
      assert.ok(err instanceof CircuitBreakerOpenError);
      assert.equal(err.circuitName, "test_tripping");
      return true;
    }
  );
  assert.equal(targetInvoked, false, "Underlying operation must not be called when circuit is open");
});

test("CircuitBreaker: executes fallback when circuit is open or failing", async () => {
  const breaker = new CircuitBreaker("test_fallback", { failureThreshold: 1, recoveryTimeMs: 100 });

  // Trip to open
  await assert.rejects(() => breaker.execute(async () => { throw new Error("Down"); }));
  assert.equal(breaker.getState(), "open");

  // Call with fallback
  const fallbackResult = await breaker.execute(
    async () => "live",
    async () => "degraded_cached_fallback"
  );
  assert.equal(fallbackResult, "degraded_cached_fallback");
});

test("CircuitBreaker: half-open probe recovery recovers to closed upon success", async () => {
  const breaker = new CircuitBreaker("test_recovery", { failureThreshold: 2, recoveryTimeMs: 50 });

  // Trip to open
  await assert.rejects(() => breaker.execute(async () => { throw new Error("Down"); }));
  await assert.rejects(() => breaker.execute(async () => { throw new Error("Down"); }));
  assert.equal(breaker.getState(), "open");

  // Wait 60ms for recovery cooldown
  await new Promise((r) => setTimeout(r, 60));

  assert.equal(breaker.getState(), "half_open");

  // Successful probe
  const probeResult = await breaker.execute(async () => "recovered_ok");
  assert.equal(probeResult, "recovered_ok");

  // Breaker must now be closed again
  assert.equal(breaker.getState(), "closed");
});

test("CircuitBreaker: failing probe in half-open state trips back to open", async () => {
  const breaker = new CircuitBreaker("test_probe_fail", { failureThreshold: 1, recoveryTimeMs: 50 });

  await assert.rejects(() => breaker.execute(async () => { throw new Error("Down"); }));
  assert.equal(breaker.getState(), "open");

  await new Promise((r) => setTimeout(r, 60));
  assert.equal(breaker.getState(), "half_open");

  // Failing probe
  await assert.rejects(() => breaker.execute(async () => { throw new Error("Still failing"); }));
  assert.equal(breaker.getState(), "open");
});

test("Unified Circuit Facade: executes with registry named breaker and resets", async () => {
  resetCircuit("test_facade");

  const val = await executeWithBreaker("test_facade", async () => 42);
  assert.equal(val, 42);
  assert.equal(getCircuitState("test_facade"), "closed");

  const stats = getCircuitStats("test_facade");
  assert.equal(stats.totalSuccesses, 1);
});
