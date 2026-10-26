import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PostgresDurableQueue } from "../src/lib/queue/postgres-queue.ts";

describe("PostgreSQL Durable Queue", () => {
  it("enqueues a job with correct defaults and metadata", async () => {
    const jobs = [];
    const mockPool = {
      query: async (sql, params) => {
        if (sql.includes("INSERT INTO durable_jobs")) {
          const row = {
            id: params[0],
            type: params[1],
            payload: JSON.parse(params[2]),
            priority: params[3],
            status: "pending",
            attempts: 0,
            max_attempts: params[4],
            created_at: new Date(),
            updated_at: new Date(),
          };
          jobs.push(row);
          return { rows: [row] };
        }
        return { rows: [] };
      },
    };

    const queue = new PostgresDurableQueue(mockPool);
    const job = await queue.enqueue("notification", { userId: "user-1", email: "test@example.com" }, {
      priority: "high",
      maxRetries: 5,
    });

    assert.ok(job.id.startsWith("job_"));
    assert.equal(job.type, "notification");
    assert.equal(job.priority, "high");
    assert.equal(job.maxAttempts, 5);
    assert.equal(job.attempts, 0);
    assert.equal(job.status, "pending");
  });

  it("handles empty queue when leasing jobs", async () => {
    const queue = new PostgresDurableQueue();
    // When DB is unconfigured, leaseBatch returns empty array safely
    const batch = await queue.leaseBatch(10);
    assert.deepEqual(batch, []);
  });

  it("calculates stats correctly across statuses", async () => {
    const mockPool = {
      query: async (sql) => {
        if (sql.includes("SELECT status, COUNT(*)")) {
          return {
            rows: [
              { status: "pending", count: "14" },
              { status: "leased", count: "3" },
              { status: "completed", count: "120" },
              { status: "failed", count: "2" },
            ],
          };
        }
        return { rows: [] };
      },
    };

    const queue = new PostgresDurableQueue(mockPool);
    const stats = await queue.getStats();

    assert.equal(stats.pendingCount, 14);
    assert.equal(stats.processingCount, 3);
    assert.equal(stats.completedCount, 120);
    assert.equal(stats.failedCount, 2);
    assert.equal(stats.deadLetterCount, 2);
  });

  it("replays dead-letter jobs with type filtering", async () => {
    let executedSql = "";
    let executedParams = [];

    const mockPool = {
      query: async (sql, params) => {
        executedSql = sql;
        executedParams = params;
        return { rowCount: 4 };
      },
    };

    const queue = new PostgresDurableQueue(mockPool);
    const replayed = await queue.replayDeadLetters("matching_recalc");

    assert.equal(replayed, 4);
    assert.ok(executedSql.includes("UPDATE durable_jobs"));
    assert.ok(executedSql.includes("status = 'pending'"));
    assert.equal(executedParams[0], "matching_recalc");
  });
});
