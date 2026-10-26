import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ParameterizedQueryBuilder } from "../src/lib/db/query-builder.ts";

describe("Parameterized SQL Query Builder & Injection Protection", () => {
  it("builds simple SELECT query with default asterisk", () => {
    const qb = new ParameterizedQueryBuilder();
    const query = qb.from("jobs").build();

    assert.equal(query.text, "SELECT * FROM jobs");
    assert.deepEqual(query.values, []);
  });

  it("builds custom SELECT fields with safe identifiers", () => {
    const qb = new ParameterizedQueryBuilder();
    const query = qb.select(["id", "title", "company"]).from("jobs").build();

    assert.equal(query.text, "SELECT id, title, company FROM jobs");
    assert.deepEqual(query.values, []);
  });

  it("parameterizes WHERE equality clauses with positional $1, $2 markers", () => {
    const qb = new ParameterizedQueryBuilder();
    const query = qb
      .from("jobs")
      .whereEq("work_arrangement", "Remote")
      .whereEq("employment_type", "Full Time")
      .build();

    assert.equal(query.text, "SELECT * FROM jobs WHERE work_arrangement = $1 AND employment_type = $2");
    assert.deepEqual(query.values, ["Remote", "Full Time"]);
  });

  it("handles WHERE IN clauses with multiple parameter placeholders", () => {
    const qb = new ParameterizedQueryBuilder();
    const query = qb
      .from("applications")
      .whereIn("status", ["Under Review", "Shortlisted", "Offered"])
      .build();

    assert.equal(query.text, "SELECT * FROM applications WHERE status IN ($1, $2, $3)");
    assert.deepEqual(query.values, ["Under Review", "Shortlisted", "Offered"]);
  });

  it("handles empty WHERE IN clauses safely by generating false condition 1 = 0", () => {
    const qb = new ParameterizedQueryBuilder();
    const query = qb
      .from("applications")
      .whereIn("candidate_id", [])
      .build();

    assert.equal(query.text, "SELECT * FROM applications WHERE 1 = 0");
    assert.deepEqual(query.values, []);
  });

  it("applies ORDER BY, LIMIT, and OFFSET in canonical SQL sequence", () => {
    const qb = new ParameterizedQueryBuilder();
    const query = qb
      .select("id, title")
      .from("jobs")
      .whereEq("is_featured", true)
      .orderBy("created_at", "DESC")
      .limit(20)
      .offset(40)
      .build();

    assert.equal(
      query.text,
      "SELECT id, title FROM jobs WHERE is_featured = $1 ORDER BY created_at DESC LIMIT 20 OFFSET 40"
    );
    assert.deepEqual(query.values, [true]);
  });

  it("strictly rejects SQL injection attempts in table identifiers", () => {
    const qb = new ParameterizedQueryBuilder();

    assert.throws(
      () => {
        qb.from("jobs; DROP TABLE candidates; --");
      },
      {
        message: /Invalid or unsafe SQL identifier/,
      }
    );
  });

  it("strictly rejects SQL injection attempts in column identifiers", () => {
    const qb = new ParameterizedQueryBuilder();

    assert.throws(
      () => {
        qb.select(["id", "title' OR 1=1 --"]).from("jobs");
      },
      {
        message: /Invalid or unsafe SQL identifier/,
      }
    );
  });

  it("throws clear error when build is called without a table name", () => {
    const qb = new ParameterizedQueryBuilder();
    assert.throws(() => qb.build(), {
      message: /table name is required/,
    });
  });
});
