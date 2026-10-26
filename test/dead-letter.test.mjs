import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  listDeadLetterJobs,
  getDeadLetterSummary,
  replayDeadLetterJob,
  replayDeadLetterBatch,
} from "../src/lib/queue/dead-letter.ts";

describe("Dead-Letter Queue Management", () => {
  it("lists dead letter jobs with type filtering and pagination", async () => {
    let capturedSql = "";
    let capturedParams = [];

    const mockPool = {
      query: async (sql, params) => {
        capturedSql = sql;
        capturedParams = params;
        return {
          rows: [
            {
              id: "job_failed_1",
              type: "notification",
              payload: { candidateId: "cand-1" },
              priority: "high",
              attempts: 3,
              max_attempts: 3,
              failed_reason: "SMTP timeout after 5000ms",
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      },
    };

    const jobs = await listDeadLetterJobs({
      type: "notification",
      limit: 10,
      offset: 0,
      pool: mockPool,
    });

    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].id, "job_failed_1");
    assert.equal(jobs[0].type, "notification");
    assert.equal(jobs[0].failedReason, "SMTP timeout after 5000ms");
    assert.ok(capturedSql.includes("WHERE status = 'failed'"));
    assert.equal(capturedParams[0], "notification");
    assert.equal(capturedParams[1], 10);
  });

  it("produces an accurate dead letter summary grouped by type and reason", async () => {
    const mockPool = {
      query: async (sql) => {
        if (sql.includes("GROUP BY type")) {
          return {
            rows: [
              { type: "notification", count: "8" },
              { type: "matching_recalc", count: "3" },
            ],
          };
        }
        if (sql.includes("GROUP BY COALESCE(failed_reason")) {
          return {
            rows: [
              { reason: "Connection terminated unexpectedly", count: "7" },
              { reason: "Candidate not found", count: "4" },
            ],
          };
        }
        return { rows: [] };
      },
    };

    const summary = await getDeadLetterSummary({ pool: mockPool });

    assert.equal(summary.totalFailed, 11);
    assert.equal(summary.byType.notification, 8);
    assert.equal(summary.byType.matching_recalc, 3);
    assert.equal(summary.commonReasons.length, 2);
    assert.equal(summary.commonReasons[0].count, 7);
  });

  it("replays single and batch dead letter jobs", async () => {
    let singleReplaySql = "";
    let batchReplaySql = "";

    const mockPool = {
      query: async (sql) => {
        if (sql.includes("WHERE id = $1 AND status = 'failed'")) {
          singleReplaySql = sql;
          return { rowCount: 1 };
        }
        if (sql.includes("WITH target_jobs AS")) {
          batchReplaySql = sql;
          return { rowCount: 5 };
        }
        return { rowCount: 0 };
      },
    };

    const singleOk = await replayDeadLetterJob("job_xyz", { pool: mockPool });
    assert.equal(singleOk, true);
    assert.ok(singleReplaySql.includes("SET status = 'pending'"));

    const batchCount = await replayDeadLetterBatch({
      type: "notification",
      limit: 5,
      pool: mockPool,
    });
    assert.equal(batchCount, 5);
    assert.ok(batchReplaySql.includes("durable_jobs.id = target_jobs.id"));
  });
});
