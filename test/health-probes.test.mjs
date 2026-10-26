import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { checkAdminAuth } from "../src/lib/auth/admin.ts";
import { checkReplicationLag } from "../src/lib/db/replica-lag.ts";
import { getBackgroundQueue, getDurableQueue } from "../src/lib/queue/index.ts";
import { getDeadLetterSummary } from "../src/lib/queue/dead-letter.ts";
import { getCacheStats } from "../src/lib/cache/index.ts";
import { getAllCircuitStats } from "../src/lib/circuit-breaker/index.ts";
import { isGlobalRateLimitingActive } from "../src/lib/ratelimit/index.ts";
import { getStorageProvider } from "../src/lib/storage/index.ts";

describe("Tri-Level Health Probes & Operator Diagnostics", () => {
  it("verifies /api/health/live source contract and RFC 8615 liveness headers", () => {
    const liveFilePath = path.resolve("src/app/api/health/live/route.ts");
    assert.ok(fs.existsSync(liveFilePath), "Liveness route file must exist");

    const content = fs.readFileSync(liveFilePath, "utf8");
    assert.ok(content.includes('export const dynamic = "force-dynamic"'));
    assert.ok(content.includes("export const revalidate = 0"));
    assert.ok(content.includes('status: "live"'));
    assert.ok(content.includes("uptimeSeconds: Math.floor(process.uptime())"));
    assert.ok(content.includes('"X-Health-Check": "liveness"'));
    assert.ok(content.includes("private, no-cache, no-store, must-revalidate"));
  });

  it("verifies /api/health/ready source contract, dependency checks, and 503 fallback", () => {
    const readyFilePath = path.resolve("src/app/api/health/ready/route.ts");
    assert.ok(fs.existsSync(readyFilePath), "Readiness route file must exist");

    const content = fs.readFileSync(readyFilePath, "utf8");
    assert.ok(content.includes('export const dynamic = "force-dynamic"'));
    assert.ok(content.includes("export const revalidate = 0"));
    assert.ok(content.includes("checkDatabaseHealth"));
    assert.ok(content.includes("getStorageProvider"));
    assert.ok(content.includes('"X-Health-Check": "readiness"'));
    assert.ok(content.includes("const statusCode = isReady ? 200 : 503"));
  });

  it("verifies storage provider readiness inspection", () => {
    const storage = getStorageProvider();
    assert.ok(storage, "Storage provider should be resolvable");
    assert.ok(typeof storage.name === "string");
  });

  it("verifies /api/health/diagnostics security contract requires admin authorization", () => {
    const diagFilePath = path.resolve("src/app/api/health/diagnostics/route.ts");
    assert.ok(fs.existsSync(diagFilePath), "Diagnostics route file must exist");

    const content = fs.readFileSync(diagFilePath, "utf8");
    assert.ok(content.includes('export const dynamic = "force-dynamic"'));
    assert.ok(content.includes("export const revalidate = 0"));
    assert.ok(content.includes("checkAdminAuth"));
    assert.ok(content.includes("status: 401"));
  });

  it("verifies checkAdminAuth properly validates admin key header for diagnostics", () => {
    const secret = "test-operator-secret-token";
    process.env.AVSAR_ADMIN_SECRET = secret;

    // Unauthorized request with missing header
    const mockReqUnauthorized = {
      headers: new Headers(),
      cookies: { get: () => undefined },
    };
    const unauthResult = checkAdminAuth(mockReqUnauthorized);
    assert.equal(unauthResult.authorized, false);

    // Authorized request with matching x-admin-key header
    const mockReqAuthorized = {
      headers: new Headers({
        "x-admin-key": secret,
      }),
      cookies: { get: () => undefined },
    };
    const authResult = checkAdminAuth(mockReqAuthorized);
    assert.equal(authResult.authorized, true);
  });

  it("verifies diagnostic telemetry feeds (replication lag, queues, cache, breakers)", async () => {
    const replicaLag = await checkReplicationLag();
    assert.ok(typeof replicaLag.healthy === "boolean");
    assert.ok(typeof replicaLag.configured === "boolean");

    const memoryQueue = getBackgroundQueue().getStats();
    assert.ok(typeof memoryQueue.pendingCount === "number");
    assert.ok(typeof memoryQueue.completedCount === "number");

    const durableQueue = await getDurableQueue().getStats();
    assert.ok(typeof durableQueue.pendingCount === "number");
    assert.ok(typeof durableQueue.processingCount === "number");

    const deadLetter = await getDeadLetterSummary();
    assert.ok(typeof deadLetter.totalFailed === "number");
    assert.ok(typeof deadLetter.byType === "object");

    const cacheStats = getCacheStats();
    assert.ok(typeof cacheStats.hits === "number");
    assert.ok(typeof cacheStats.misses === "number");

    const circuitStats = getAllCircuitStats();
    assert.ok(typeof circuitStats === "object");

    const isRateLimiting = isGlobalRateLimitingActive();
    assert.ok(typeof isRateLimiting === "boolean");
  });
});
