#!/usr/bin/env node
/**
 * Avsar Enterprise High-Concurrency Benchmark & Load Testing Runner
 *
 * Simulates high concurrency (1,000 virtual users) executing realistic recruitment
 * platform user journeys with configurable think-times, ramp-up, and latency percentiles.
 *
 * Usage:
 *   node scripts/load-test.mjs --users 100 --duration 30 --target http://localhost:3000
 */

import http from "node:http";
import https from "node:https";

const args = process.argv.slice(2);
function getArg(name, defaultValue) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return defaultValue;
}

const TARGET_BASE = (getArg("target", "http://localhost:3000")).replace(/\/+$/, "");
const CONCURRENT_USERS = parseInt(getArg("users", "100"), 10);
const DURATION_SECONDS = parseInt(getArg("duration", "30"), 10);
const RAMPUP_SECONDS = parseInt(getArg("rampup", "5"), 10);

console.log("================================================================================");
console.log("AVSAR ENTERPRISE HIGH-CONCURRENCY BENCHMARK RUNNER");
console.log(`Target:           ${TARGET_BASE}`);
console.log(`Virtual Users:    ${CONCURRENT_USERS} CCU`);
console.log(`Test Duration:    ${DURATION_SECONDS} seconds (Ramp-up: ${RAMPUP_SECONDS}s)`);
console.log("================================================================================\n");

// Custom HTTP Agent with connection reuse
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 500 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 500 });

const latencies = [];
const routeLatencies = new Map();
let totalRequests = 0;
let successRequests = 0;
let errorRequests = 0;
let startTime = 0;
let isRunning = true;

const SAMPLE_SEARCHES = ["engineer", "developer", "intern", "react", "python", "product", "design", "data"];
const SAMPLE_CATEGORIES = ["Engineering", "Product", "Analytics", "Design"];

function getAgent(url) {
  return url.startsWith("https") ? httpsAgent : httpAgent;
}

function recordLatency(route, durationMs, isSuccess) {
  latencies.push(durationMs);
  totalRequests++;
  if (isSuccess) {
    successRequests++;
  } else {
    errorRequests++;
  }

  if (!routeLatencies.has(route)) {
    routeLatencies.set(route, { latencies: [], errors: 0 });
  }
  const entry = routeLatencies.get(route);
  entry.latencies.push(durationMs);
  if (!isSuccess) entry.errors++;
}

async function executeJourney(userId) {
  const roll = Math.random();

  try {
    if (roll < 0.40) {
      // J1: Public Job Discovery & Search
      const q = SAMPLE_SEARCHES[Math.floor(Math.random() * SAMPLE_SEARCHES.length)];
      const cat = SAMPLE_CATEGORIES[Math.floor(Math.random() * SAMPLE_CATEGORIES.length)];
      const url = `${TARGET_BASE}/api/jobs?q=${q}&category=${encodeURIComponent(cat)}&limit=10`;

      const t0 = performance.now();
      const res = await fetch(url, { agent: getAgent(url) });
      const duration = performance.now() - t0;
      recordLatency("GET /api/jobs", duration, res.ok);
    } else if (roll < 0.70) {
      // J2: Public Job Details
      const url = `${TARGET_BASE}/api/jobs/job_google_fe_intern`;
      const t0 = performance.now();
      const res = await fetch(url, { agent: getAgent(url) });
      const duration = performance.now() - t0;
      recordLatency("GET /api/jobs/[id]", duration, res.ok);
    } else if (roll < 0.85) {
      // J3: Health & Readiness Probe
      const url = `${TARGET_BASE}/api/health`;
      const t0 = performance.now();
      const res = await fetch(url, { agent: getAgent(url) });
      const duration = performance.now() - t0;
      recordLatency("GET /api/health", duration, res.ok);
    } else if (roll < 0.95) {
      // J4: Core Static Page Load
      const url = `${TARGET_BASE}/welcome`;
      const t0 = performance.now();
      const res = await fetch(url, { agent: getAgent(url) });
      const duration = performance.now() - t0;
      recordLatency("GET /welcome", duration, res.ok);
    } else {
      // J5: Saved Jobs Query
      const url = `${TARGET_BASE}/api/jobs/saved`;
      const t0 = performance.now();
      const res = await fetch(url, { agent: getAgent(url) });
      const duration = performance.now() - t0;
      // 401 Unauthorized is expected for unauthenticated client, not a server error
      recordLatency("GET /api/jobs/saved", duration, res.status === 200 || res.status === 401);
    }
  } catch (err) {
    recordLatency("NETWORK_ERROR", 0, false);
  }
}

async function runVirtualUser(userId) {
  // Staggered ramp-up delay
  const rampupDelay = (userId / CONCURRENT_USERS) * (RAMPUP_SECONDS * 1000);
  await new Promise((resolve) => setTimeout(resolve, rampupDelay));

  while (isRunning) {
    await executeJourney(userId);
    // Simulated micro think-time between operations (100ms - 300ms in stress simulation)
    const thinkTime = 100 + Math.random() * 200;
    await new Promise((resolve) => setTimeout(resolve, thinkTime));
  }
}

function computePercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)].toFixed(1);
}

async function startLoadTest() {
  startTime = performance.now();

  const userPromises = [];
  for (let u = 0; u < CONCURRENT_USERS; u++) {
    userPromises.push(runVirtualUser(u));
  }

  // Progress heartbeat
  const interval = setInterval(() => {
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(0);
    const rps = (totalRequests / (elapsed > 0 ? elapsed : 1)).toFixed(1);
    process.stdout.write(`\r[T+${elapsed}s] Requests: ${totalRequests} | RPS: ${rps} | Errors: ${errorRequests}   `);
  }, 1000);

  await new Promise((resolve) => setTimeout(resolve, DURATION_SECONDS * 1000));
  isRunning = false;
  clearInterval(interval);
  await Promise.allSettled(userPromises);

  const totalTimeSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
  const avgRps = (totalRequests / totalTimeSeconds).toFixed(1);
  const errorRate = ((errorRequests / (totalRequests || 1)) * 100).toFixed(2);

  console.log("\n\n================================================================================");
  console.log("BENCHMARK EXECUTION SUMMARY");
  console.log("================================================================================");
  console.log(`Duration:              ${totalTimeSeconds} seconds`);
  console.log(`Total Requests:        ${totalRequests}`);
  console.log(`Successful Requests:   ${successRequests}`);
  console.log(`Failed Requests:       ${errorRequests} (${errorRate}% error rate)`);
  console.log(`Average Throughput:    ${avgRps} requests/sec`);
  console.log("--------------------------------------------------------------------------------");
  console.log(`Global Latency p50:    ${computePercentile(latencies, 50)} ms`);
  console.log(`Global Latency p90:    ${computePercentile(latencies, 90)} ms`);
  console.log(`Global Latency p95:    ${computePercentile(latencies, 95)} ms`);
  console.log(`Global Latency p99:    ${computePercentile(latencies, 99)} ms`);
  console.log("--------------------------------------------------------------------------------");
  console.log("Per-Route Latency Breakdown:");
  for (const [route, stats] of routeLatencies.entries()) {
    const count = stats.latencies.length;
    const p50 = computePercentile(stats.latencies, 50);
    const p95 = computePercentile(stats.latencies, 95);
    console.log(`  ${route.padEnd(25)} | Count: ${String(count).padStart(5)} | p50: ${p50.padStart(5)} ms | p95: ${p95.padStart(5)} ms | Errors: ${stats.errors}`);
  }
  console.log("================================================================================\n");

  // Output JSON metrics report for CI/telemetry verification
  const report = {
    target: TARGET_BASE,
    concurrentUsers: CONCURRENT_USERS,
    durationSeconds: parseFloat(totalTimeSeconds),
    totalRequests,
    successRequests,
    errorRequests,
    errorRatePercent: parseFloat(errorRate),
    avgRps: parseFloat(avgRps),
    percentiles: {
      p50: parseFloat(computePercentile(latencies, 50)),
      p90: parseFloat(computePercentile(latencies, 90)),
      p95: parseFloat(computePercentile(latencies, 95)),
      p99: parseFloat(computePercentile(latencies, 99)),
    },
  };

  return report;
}

startLoadTest().catch((err) => {
  console.error("[Load Test Error]:", err);
  process.exit(1);
});
