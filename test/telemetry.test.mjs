import test from "node:test";
import assert from "node:assert/strict";
import {
  extractOrCreateTraceContext,
  injectTraceHeaders,
  formatServerTiming,
} from "../src/lib/telemetry/correlation.ts";
import { HighResolutionTimer } from "../src/lib/telemetry/timer.ts";
import { MetricsCollector } from "../src/lib/telemetry/metrics.ts";
import {
  recordMetric,
  getMetricSnapshot,
  resetTelemetryForTesting,
} from "../src/lib/telemetry/index.ts";

test("Telemetry Correlation: extracts existing correlation ID from headers", () => {
  const req = {
    headers: new Headers({
      "x-request-id": "req_prod_abc12345",
    }),
  };
  const ctx = extractOrCreateTraceContext(req);
  assert.equal(ctx.traceId, "req_prod_abc12345");
  assert.ok(ctx.spanId);
  assert.ok(typeof ctx.startTime === "number");

  const outHeaders = new Headers();
  injectTraceHeaders(outHeaders, ctx);
  assert.equal(outHeaders.get("X-Request-ID"), "req_prod_abc12345");
  assert.equal(outHeaders.get("X-Trace-ID"), "req_prod_abc12345");
});

test("Telemetry Correlation: generates safe random UUID when header is missing or malicious", () => {
  // Scenario 1: Missing headers
  const ctx1 = extractOrCreateTraceContext();
  assert.ok(ctx1.traceId.length >= 32);

  // Scenario 2: Header with invalid characters / injection attempt
  const reqInvalid = {
    headers: {
      get: (name) => (name.toLowerCase() === "x-request-id" ? "bad;evil=1;injection<script>" : null),
    },
  };
  const ctx2 = extractOrCreateTraceContext(reqInvalid);
  assert.notEqual(ctx2.traceId, "bad;evil=1;injection<script>");
  assert.ok(ctx2.traceId.length >= 32);
});

test("Telemetry Correlation: formats W3C Server-Timing header", () => {
  const spans = [
    { name: "db_query", traceId: "t1", spanId: "s1", startTime: 0, durationMs: 14.5 },
    { name: "cache_lookup", traceId: "t1", spanId: "s2", startTime: 0, durationMs: 0.8 },
  ];
  const header = formatServerTiming(spans);
  assert.equal(header, "db_query;dur=14.5, cache_lookup;dur=0.8");
});

test("HighResolutionTimer: tracks execution duration and spans accurately", async () => {
  const timer = new HighResolutionTimer();

  const { result, durationMs } = await timer.timeAsync("simulated_db_call", async () => {
    await new Promise((r) => setTimeout(r, 25));
    return "query_done";
  });

  assert.equal(result, "query_done");
  assert.ok(durationMs >= 20, `Duration too low: ${durationMs}`);

  const spans = timer.getSpans();
  assert.equal(spans.length, 1);
  assert.equal(spans[0].name, "simulated_db_call");
  assert.ok(timer.getTotalDurationMs() >= durationMs);
});

test("MetricsCollector: computes accurate percentiles with bounded memory", () => {
  const collector = new MetricsCollector(100);

  // Record values from 1 to 100
  for (let i = 1; i <= 100; i++) {
    collector.recordDuration("db_query", i);
  }

  const snapshot = collector.getSnapshot("db_query");
  assert.equal(snapshot.count, 100);
  assert.equal(snapshot.min, 1);
  assert.equal(snapshot.max, 100);
  assert.equal(snapshot.avg, 50.5);
  assert.equal(snapshot.p50, 51);
  assert.equal(snapshot.p90, 91);
  assert.equal(snapshot.p95, 96);
  assert.equal(snapshot.p99, 100);

  // Add 10 more to test reservoir eviction
  for (let i = 101; i <= 110; i++) {
    collector.recordDuration("db_query", i);
  }
  const boundedSnapshot = collector.getSnapshot("db_query");
  assert.equal(boundedSnapshot.count, 100, "Reservoir must enforce bounded capacity of 100");
  assert.equal(boundedSnapshot.min, 11, "Oldest 10 samples should have been evicted");
});

test("Unified Telemetry Facade: stores global metrics", () => {
  resetTelemetryForTesting();

  recordMetric("api_request", 15.2);
  recordMetric("api_request", 25.8);

  const snapshot = getMetricSnapshot("api_request");
  assert.equal(snapshot.count, 2);
  assert.equal(snapshot.min, 15.2);
  assert.equal(snapshot.max, 25.8);

  resetTelemetryForTesting();
});
