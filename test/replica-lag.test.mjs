import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  pinCandidateToPrimary,
  shouldRouteToPrimary,
  clearCandidatePinsForTesting,
  checkReplicationLag,
} from "../src/lib/db/replica-lag.ts";

describe("Read-After-Write Consistency and Replica Lag", () => {
  const originalEnv = process.env.POSTGRES_READ_URL;

  beforeEach(() => {
    clearCandidatePinsForTesting();
    delete process.env.POSTGRES_READ_URL;
  });

  it("routes all reads to primary when read replica is not configured", () => {
    assert.equal(shouldRouteToPrimary("cand-123"), true);
    assert.equal(shouldRouteToPrimary(null), true);
  });

  it("reports accurate unconfigured status when no read replica exists", async () => {
    const report = await checkReplicationLag();
    assert.equal(report.configured, false);
    assert.equal(report.lagSeconds, null);
    assert.equal(report.status, "NOT_CONFIGURED");
    assert.equal(report.healthy, true);
  });

  it("pins candidate to primary immediately after mutation when replica is configured", () => {
    process.env.POSTGRES_READ_URL = "postgres://replica:pass@localhost:5432/avsar_replica";

    // Unpinned candidate defaults to read replica
    assert.equal(shouldRouteToPrimary("cand-alice"), false);

    // Pin candidate following profile mutation
    pinCandidateToPrimary("cand-alice", 1000);

    // Candidate is now pinned to primary
    assert.equal(shouldRouteToPrimary("cand-alice"), true);

    // Another candidate is unaffected and can read from replica
    assert.equal(shouldRouteToPrimary("cand-bob"), false);

    process.env.POSTGRES_READ_URL = originalEnv;
  });

  it("expires candidate pin after specified duration", async () => {
    process.env.POSTGRES_READ_URL = "postgres://replica:pass@localhost:5432/avsar_replica";

    pinCandidateToPrimary("cand-temp", 50); // 50ms pin
    assert.equal(shouldRouteToPrimary("cand-temp"), true);

    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.equal(shouldRouteToPrimary("cand-temp"), false);

    process.env.POSTGRES_READ_URL = originalEnv;
  });
});
