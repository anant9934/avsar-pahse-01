import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runDailyMaintenance } from "../scripts/daily-maintenance.mjs";

describe("Daily Database Maintenance & Pruning Task", () => {
  function createMockMaintenancePool() {
    const executedQueries = [];

    const mockPool = {
      query: async (sql) => {
        executedQueries.push(sql);
        if (sql.includes("SELECT count(*)")) {
          return { rows: [{ count: 12 }], rowCount: 1 };
        }
        if (sql.includes("DELETE FROM")) {
          return { rows: [], rowCount: 5 };
        }
        return { rows: [], rowCount: 0 };
      },
    };

    return { mockPool, executedQueries };
  }

  it("handles unconfigured database safely", async () => {
    const origEnv = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;

    try {
      const result = await runDailyMaintenance(null);
      assert.equal(result.expiredIdempotencyKeysPurged, 0);
      assert.equal(result.completedJobsPurged, 0);
      assert.equal(result.agedAuditLogsPurged, 0);
    } finally {
      if (origEnv) process.env.DATABASE_URL = origEnv;
    }
  });

  it("executes dry-run inspection without deleting records", async () => {
    const { mockPool, executedQueries } = createMockMaintenancePool();

    const result = await runDailyMaintenance(mockPool, { dryRun: true });

    assert.equal(result.isDryRun, true);
    assert.equal(result.expiredIdempotencyKeysPurged, 12);
    assert.equal(result.completedJobsPurged, 12);
    assert.equal(result.agedAuditLogsPurged, 12);

    // Verify all queries were SELECT and no DELETE was executed
    assert.ok(executedQueries.every((q) => q.startsWith("SELECT")));
    assert.ok(!executedQueries.some((q) => q.startsWith("DELETE")));
  });

  it("executes live pruning deletes with correct expiration filters", async () => {
    const { mockPool, executedQueries } = createMockMaintenancePool();

    const result = await runDailyMaintenance(mockPool, { dryRun: false });

    assert.equal(result.isDryRun, false);
    assert.equal(result.expiredIdempotencyKeysPurged, 5);
    assert.equal(result.completedJobsPurged, 5);
    assert.equal(result.agedAuditLogsPurged, 5);

    // Verify DELETE statements for all three target tables
    assert.ok(executedQueries.some((q) => q.includes("DELETE FROM idempotency_keys")));
    assert.ok(executedQueries.some((q) => q.includes("DELETE FROM durable_jobs")));
    assert.ok(executedQueries.some((q) => q.includes("DELETE FROM audit_events")));
  });
});
