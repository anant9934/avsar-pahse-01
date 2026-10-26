import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withTransaction } from "../src/lib/db/transaction-helper.ts";

describe("PostgreSQL Transaction Wrapper & Serialization Retries", () => {
  function createMockTransactionPool(options = {}) {
    const executedQueries = [];
    let releaseCalled = false;
    let attempts = 0;

    const mockClient = {
      query: async (sql) => {
        executedQueries.push(sql);

        if (options.failOnAttempt && options.failOnAttempt === attempts) {
          const err = new Error(options.failMessage || "Query failed");
          if (options.failCode) {
            err.code = options.failCode;
          }
          throw err;
        }

        return { rows: [], rowCount: 0 };
      },
      release: () => {
        releaseCalled = true;
      },
    };

    const mockPool = {
      connect: async () => {
        attempts++;
        return mockClient;
      },
    };

    return { mockPool, mockClient, executedQueries, getReleaseCalled: () => releaseCalled };
  }

  it("executes top-level transaction with BEGIN and COMMIT on success", async () => {
    const { mockPool, executedQueries, getReleaseCalled } = createMockTransactionPool();

    const result = await withTransaction(mockPool, async (client) => {
      await client.query("INSERT INTO jobs (id) VALUES ('j1')");
      return "COMMITTED";
    });

    assert.equal(result, "COMMITTED");
    assert.equal(executedQueries[0], "BEGIN");
    assert.equal(executedQueries[1], "INSERT INTO jobs (id) VALUES ('j1')");
    assert.equal(executedQueries[2], "COMMIT");
    assert.equal(getReleaseCalled(), true);
  });

  it("rolls back transaction with ROLLBACK on unhandled exception", async () => {
    const { mockPool, executedQueries, getReleaseCalled } = createMockTransactionPool();

    await assert.rejects(
      async () => {
        await withTransaction(mockPool, async (client) => {
          await client.query("INSERT INTO applications (id) VALUES ('app1')");
          throw new Error("Application validation failed");
        });
      },
      {
        message: /Application validation failed/,
      }
    );

    assert.equal(executedQueries[0], "BEGIN");
    assert.equal(executedQueries[1], "INSERT INTO applications (id) VALUES ('app1')");
    assert.equal(executedQueries[2], "ROLLBACK");
    assert.equal(getReleaseCalled(), true);
  });

  it("handles nested transaction using SAVEPOINT and RELEASE SAVEPOINT", async () => {
    const executedQueries = [];
    const mockClient = {
      query: async (sql) => {
        executedQueries.push(sql);
        return { rows: [], rowCount: 0 };
      },
    };

    const result = await withTransaction(mockClient, async (client) => {
      await client.query("UPDATE candidates SET name = 'Rohan' WHERE id = 'c1'");
      return "NESTED_OK";
    });

    assert.equal(result, "NESTED_OK");
    assert.ok(executedQueries[0].startsWith("SAVEPOINT sp_"));
    assert.equal(executedQueries[1], "UPDATE candidates SET name = 'Rohan' WHERE id = 'c1'");
    assert.ok(executedQueries[2].startsWith("RELEASE SAVEPOINT sp_"));
  });

  it("rolls back nested transaction to SAVEPOINT on nested error", async () => {
    const executedQueries = [];
    const mockClient = {
      query: async (sql) => {
        executedQueries.push(sql);
        return { rows: [], rowCount: 0 };
      },
    };

    await assert.rejects(
      async () => {
        await withTransaction(mockClient, async (client) => {
          await client.query("DELETE FROM saved_jobs WHERE candidate_id = 'c1'");
          throw new Error("Savepoint error");
        });
      },
      {
        message: /Savepoint error/,
      }
    );

    assert.ok(executedQueries[0].startsWith("SAVEPOINT sp_"));
    assert.equal(executedQueries[1], "DELETE FROM saved_jobs WHERE candidate_id = 'c1'");
    assert.ok(executedQueries[2].startsWith("ROLLBACK TO SAVEPOINT sp_"));
  });

  it("retries transaction on serialization failure (SQLSTATE 40001) and succeeds", async () => {
    let callCount = 0;
    const executedQueries = [];

    const mockClient = {
      query: async (sql) => {
        executedQueries.push(sql);
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    };

    const mockPool = {
      connect: async () => mockClient,
    };

    const result = await withTransaction(
      mockPool,
      async (client) => {
        callCount++;
        if (callCount === 1) {
          const err = new Error("could not serialize access due to concurrent update");
          err.code = "40001"; // PostgreSQL serialization failure
          throw err;
        }
        await client.query("UPDATE candidates SET eris_score = 90 WHERE id = 'c1'");
        return "RETRY_SUCCESS";
      },
      { maxRetries: 2, baseDelayMs: 5 }
    );

    assert.equal(result, "RETRY_SUCCESS");
    assert.equal(callCount, 2);
    // First attempt: BEGIN, error, ROLLBACK; Second attempt: BEGIN, query, COMMIT
    assert.ok(executedQueries.includes("ROLLBACK"));
    assert.ok(executedQueries.includes("COMMIT"));
  });

  it("does not retry on non-transient constraint errors (SQLSTATE 23505 unique_violation)", async () => {
    let callCount = 0;
    const mockClient = {
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
    };
    const mockPool = {
      connect: async () => mockClient,
    };

    await assert.rejects(
      async () => {
        await withTransaction(
          mockPool,
          async () => {
            callCount++;
            const err = new Error("duplicate key value violates unique constraint");
            err.code = "23505"; // unique_violation
            throw err;
          },
          { maxRetries: 3 }
        );
      },
      {
        message: /duplicate key value violates unique constraint/,
      }
    );

    // Should only be called once because 23505 is not retryable
    assert.equal(callCount, 1);
  });
});
