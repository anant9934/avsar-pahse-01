#!/usr/bin/env node

/**
 * Canary Health Check CLI & Automated Release Gate
 * 
 * Performs automated health validation against a newly deployed canary instance
 * before advancing traffic allocation. Verifies liveness, readiness, and API latency.
 */

/**
 * @typedef {Object} CanaryVerificationResult
 * @property {boolean} isHealthy
 * @property {number} latencyMs
 * @property {string} liveStatus
 * @property {string} readyStatus
 * @property {string[]} errors
 */

/**
 * Evaluates live canary deployment endpoints.
 * @param {Object} options
 * @param {string} [options.baseUrl]
 * @param {number} [options.maxP95Ms]
 * @param {Function} [options.fetchFn]
 * @returns {Promise<CanaryVerificationResult>}
 */
export async function verifyCanaryHealth(options = {}) {
  const baseUrl = (options.baseUrl || process.env.CANARY_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const maxP95Ms = options.maxP95Ms || 500;
  const fetchFn = options.fetchFn || fetch;
  const errors = [];

  let liveStatus = "unknown";
  let readyStatus = "unknown";
  let latencyMs = 0;

  // 1. Check Liveness Probe (/api/health/live)
  try {
    const liveRes = await fetchFn(`${baseUrl}/api/health/live`);
    if (liveRes.status !== 200) {
      errors.push(`Liveness probe failed with status ${liveRes.status}`);
    } else {
      const liveJson = await liveRes.json();
      liveStatus = liveJson.status;
      if (liveStatus !== "live") {
        errors.push(`Liveness payload returned unexpected status: ${liveStatus}`);
      }
    }
  } catch (err) {
    errors.push(`Liveness request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Check Readiness Probe (/api/health/ready)
  try {
    const readyRes = await fetchFn(`${baseUrl}/api/health/ready`);
    if (readyRes.status !== 200) {
      errors.push(`Readiness probe failed with status ${readyRes.status}`);
    } else {
      const readyJson = await readyRes.json();
      readyStatus = readyJson.status;
      if (readyStatus !== "ready") {
        errors.push(`Readiness payload returned unexpected status: ${readyStatus}`);
      }
    }
  } catch (err) {
    errors.push(`Readiness request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Measure API Latency (/api/jobs?limit=5)
  try {
    const start = performance.now();
    const jobsRes = await fetchFn(`${baseUrl}/api/jobs?limit=5`);
    latencyMs = Math.round(performance.now() - start);

    if (jobsRes.status !== 200) {
      errors.push(`Jobs API probe returned HTTP ${jobsRes.status}`);
    } else if (latencyMs > maxP95Ms) {
      errors.push(`Jobs API latency ${latencyMs}ms exceeded threshold ${maxP95Ms}ms`);
    }
  } catch (err) {
    errors.push(`Jobs API probe failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const isHealthy = errors.length === 0;

  return {
    isHealthy,
    latencyMs,
    liveStatus,
    readyStatus,
    errors,
  };
}

/**
 * CLI execution handler
 */
async function main() {
  const args = process.argv.slice(2);
  const targetUrl = args[0] || process.env.CANARY_BASE_URL || "http://localhost:3000";

  console.log(`[Canary Health Gate] Probing deployment at: ${targetUrl}`);

  const result = await verifyCanaryHealth({ baseUrl: targetUrl });

  console.log(`[Canary Health Gate] Live Status: ${result.liveStatus}`);
  console.log(`[Canary Health Gate] Ready Status: ${result.readyStatus}`);
  console.log(`[Canary Health Gate] Jobs API Latency: ${result.latencyMs}ms`);

  if (result.isHealthy) {
    console.log(`[Canary Health Gate] PASSED: All deployment gates green. Safe to advance traffic.`);
    process.exit(0);
  } else {
    console.error(`[Canary Health Gate] FAILED: Automated rollback recommended:`);
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith("canary-health-check.mjs")) {
  main().catch((err) => {
    console.error("[Canary Health Gate] Fatal error:", err);
    process.exit(1);
  });
}
