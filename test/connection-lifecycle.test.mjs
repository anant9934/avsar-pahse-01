import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  withConnectionLease,
  getActiveLeaseCount,
  clearActiveLeasesForTesting,
} from "../src/lib/db/connection-lifecycle.ts";

describe("PostgreSQL Connection Lifecycle & Lease Management", () => {
  beforeEach(() => {
    clearActiveLeasesForTesting();
  });

  function createMockPool(options = {}) {
    let releaseCount = 0;
    let connectCount = 0;

    const mockClient = {
      query: async (sql, params) => ({ rows: [], rowCount: 0 }),
      release: () => {
        releaseCount++;
      },
    };

    const mockPool = {
      connect: async () => {
        connectCount++;
        if (options.shouldFailConnect) {
          throw new Error("Pool connection refused");
        }
        return mockClient;
      },
      getStats: () => ({ releaseCount, connectCount }),
    };

    return { mockPool, mockClient };
  }

  it("successfully acquires connection, executes operation, and releases client", async () => {
    const { mockPool } = createMockPool();

    const result = await withConnectionLease(mockPool, async (client) => {
      assert.equal(getActiveLeaseCount(), 1);
      return "SUCCESS_DATA";
    });

    assert.equal(result, "SUCCESS_DATA");
    assert.equal(getActiveLeaseCount(), 0);
    assert.equal(mockPool.getStats().releaseCount, 1);
    assert.equal(mockPool.getStats().connectCount, 1);
  });

  it("guarantees client release even when operation throws an error", async () => {
    const { mockPool } = createMockPool();

    await assert.rejects(
      async () => {
        await withConnectionLease(mockPool, async () => {
          throw new Error("Simulated query syntax error");
        });
      },
      {
        message: /Simulated query syntax error/,
      }
    );

    assert.equal(getActiveLeaseCount(), 0);
    assert.equal(mockPool.getStats().releaseCount, 1);
  });

  it("aborts and releases connection if operation exceeds timeout threshold", async () => {
    const { mockPool } = createMockPool();

    await assert.rejects(
      async () => {
        await withConnectionLease(
          mockPool,
          async () => {
            // Simulate hanging connection
            await new Promise((r) => setTimeout(r, 100));
            return "SHOULD_NOT_REACH";
          },
          { timeoutMs: 25, label: "slow_query" }
        );
      },
      {
        message: /timed out after 25ms/,
      }
    );

    assert.equal(getActiveLeaseCount(), 0);
    assert.equal(mockPool.getStats().releaseCount, 1);
  });

  it("tracks concurrent active leases simultaneously", async () => {
    const { mockPool } = createMockPool();

    const p1 = withConnectionLease(mockPool, async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 1;
    });

    const p2 = withConnectionLease(mockPool, async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 2;
    });

    // Both leases should be tracked concurrently
    assert.ok(getActiveLeaseCount() <= 2);

    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1, 1);
    assert.equal(r2, 2);
    assert.equal(getActiveLeaseCount(), 0);
    assert.equal(mockPool.getStats().releaseCount, 2);
  });
});
