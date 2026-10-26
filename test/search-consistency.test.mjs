import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPostgresSearchClause,
  isSearchIndexStale,
  invalidateSearchCaches,
} from "../src/lib/jobs/search-consistency.ts";

describe("Authoritative Search Consistency and Invalidation", () => {
  it("builds parameterized full-text search and substring SQL clauses", () => {
    const clause = buildPostgresSearchClause("Backend Engineer", 1);

    assert.ok(clause.sql.includes("plainto_tsquery('english', $1)"));
    assert.ok(clause.sql.includes("LOWER(title) LIKE $2"));
    assert.ok(clause.sql.includes("LOWER(company) LIKE $2"));
    assert.equal(clause.values.length, 2);
    assert.equal(clause.values[0], "backend engineer");
    assert.equal(clause.values[1], "%backend engineer%");
    assert.equal(clause.nextParamIndex, 3);
  });

  it("handles empty or whitespace search terms cleanly", () => {
    const emptyClause = buildPostgresSearchClause("   ", 1);
    assert.equal(emptyClause.sql, "");
    assert.deepEqual(emptyClause.values, []);
    assert.equal(emptyClause.nextParamIndex, 1);
  });

  it("detects stale in-memory search indexes past threshold", () => {
    const now = Date.now();

    // Fresh index (created 10 seconds ago)
    assert.equal(isSearchIndexStale(now - 10000, 300000), false);

    // Stale index (created 10 minutes ago, past 5m threshold)
    assert.equal(isSearchIndexStale(now - 600000, 300000), true);

    // Uninitialized index
    assert.equal(isSearchIndexStale(0), true);
  });

  it("purges public search cache tags on job mutation", async () => {
    const purgedCount = await invalidateSearchCaches("job-42");
    assert.equal(typeof purgedCount, "number");
  });
});
