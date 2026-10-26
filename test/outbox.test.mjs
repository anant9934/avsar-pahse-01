import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { commitWithOutbox } from "../src/lib/queue/outbox.ts";

describe("Transactional Outbox Pattern", () => {
  it("atomically commits domain operation and outbox events in the same transaction", async () => {
    const executed = [];
    const insertedEvents = [];

    const mockClient = {
      query: async (sql, params) => {
        executed.push(sql.trim());
        if (sql.includes("INSERT INTO durable_jobs")) {
          insertedEvents.push({
            id: params[0],
            type: params[1],
            payload: JSON.parse(params[2]),
            priority: params[3],
            maxRetries: params[4],
          });
        }
        return { rows: [] };
      },
      release: () => {
        executed.push("RELEASE");
      },
    };

    const mockPool = {
      connect: async () => mockClient,
    };

    const outboxResult = await commitWithOutbox(
      async () => {
        executed.push("DOMAIN_MUTATION");
        return { applicationId: "app-test-99", status: "Under Review" };
      },
      [
        {
          type: "notification",
          payload: { candidateId: "cand-1", template: "application_received" },
          priority: "high",
        },
        {
          type: "audit_log",
          payload: { action: "submit_application", candidateId: "cand-1" },
          priority: "normal",
        },
      ],
      { pool: mockPool }
    );

    assert.equal(outboxResult.result.applicationId, "app-test-99");
    assert.equal(outboxResult.enqueuedCount, 2);

    // Verify transactional sequence: BEGIN -> DOMAIN_MUTATION -> INSERT OUTBOX -> COMMIT -> RELEASE
    assert.equal(executed[0], "BEGIN");
    assert.ok(executed.indexOf("DOMAIN_MUTATION") > 0);
    assert.ok(executed.includes("COMMIT"));
    assert.ok(executed.includes("RELEASE"));

    // Verify outbox payload integrity
    assert.equal(insertedEvents.length, 2);
    assert.equal(insertedEvents[0].type, "notification");
    assert.equal(insertedEvents[0].priority, "high");
    assert.equal(insertedEvents[1].type, "audit_log");
  });

  it("rolls back entire transaction if domain operation fails", async () => {
    const executed = [];

    const mockClient = {
      query: async (sql) => {
        executed.push(sql.trim());
        return { rows: [] };
      },
      release: () => {
        executed.push("RELEASE");
      },
    };

    const mockPool = {
      connect: async () => mockClient,
    };

    await assert.rejects(
      async () => {
        await commitWithOutbox(
          async () => {
            throw new Error("Foreign key violation on candidate ID");
          },
          [
            {
              type: "notification",
              payload: { candidateId: "invalid" },
            },
          ],
          { pool: mockPool }
        );
      },
      /Foreign key violation/
    );

    // Must execute ROLLBACK and never COMMIT
    assert.ok(executed.includes("ROLLBACK"));
    assert.ok(!executed.includes("COMMIT"));
    assert.ok(executed.includes("RELEASE"));
  });
});
