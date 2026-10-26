import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  verifyBackupSql,
  REQUIRED_TABLES,
  REQUIRED_INDEXES,
} from "../scripts/verify-backup.mjs";

describe("PostgreSQL Backup & DDL Integrity Verification", () => {
  it("approves authoritative production schema (src/lib/db/schema.sql)", () => {
    const schemaSql = fs.readFileSync(path.resolve("src/lib/db/schema.sql"), "utf8");
    const result = verifyBackupSql(schemaSql);

    assert.equal(result.isValid, true);
    assert.equal(result.missingTables.length, 0);
    assert.equal(result.missingIndexes.length, 0);
    assert.equal(result.errors.length, 0);
    assert.ok(result.tableCount >= REQUIRED_TABLES.length);
    assert.ok(result.indexCount >= REQUIRED_INDEXES.length);
  });

  it("detects missing required tables in partial dumps", () => {
    const partialSql = `
      CREATE TABLE candidates (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE jobs (id VARCHAR(255) PRIMARY KEY);
      CREATE INDEX idx_applications_candidate ON applications(candidate_id);
      CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
      CREATE INDEX idx_durable_jobs_polling ON durable_jobs(status);
      CREATE INDEX idx_resumes_candidate ON resumes(candidate_id);
      CREATE INDEX idx_saved_jobs_candidate ON saved_jobs(candidate_id);
    `;

    const result = verifyBackupSql(partialSql);
    assert.equal(result.isValid, false);
    assert.ok(result.missingTables.includes("applications"));
    assert.ok(result.missingTables.includes("durable_jobs"));
    assert.ok(result.missingTables.includes("idempotency_keys"));
    assert.ok(result.errors.some((err) => err.includes("Missing required table DDL: applications")));
  });

  it("detects missing required indexes", () => {
    const sqlWithoutIndexes = `
      CREATE TABLE candidates (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE jobs (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE applications (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE resumes (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE saved_jobs (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE idempotency_keys (key VARCHAR(255) PRIMARY KEY);
      CREATE TABLE durable_jobs (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE schema_migrations (version VARCHAR(50) PRIMARY KEY);
    `;

    const result = verifyBackupSql(sqlWithoutIndexes);
    assert.equal(result.isValid, false);
    assert.equal(result.missingTables.length, 0);
    assert.ok(result.missingIndexes.includes("idx_idempotency_expires"));
    assert.ok(result.missingIndexes.includes("idx_durable_jobs_polling"));
    assert.ok(result.errors.some((err) => err.includes("Missing required index DDL")));
  });

  it("rejects empty or whitespace-only inputs", () => {
    const emptyResult = verifyBackupSql("");
    assert.equal(emptyResult.isValid, false);
    assert.equal(emptyResult.tableCount, 0);
    assert.ok(emptyResult.errors[0].includes("empty"));

    const whitespaceResult = verifyBackupSql("   \n\t  ");
    assert.equal(whitespaceResult.isValid, false);
  });

  it("detects unclosed BEGIN transaction blocks", () => {
    const unclosedTxSql = `
      BEGIN;
      CREATE TABLE candidates (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE jobs (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE applications (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE resumes (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE saved_jobs (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE idempotency_keys (key VARCHAR(255) PRIMARY KEY);
      CREATE TABLE durable_jobs (id VARCHAR(255) PRIMARY KEY);
      CREATE TABLE schema_migrations (version VARCHAR(50) PRIMARY KEY);
      CREATE INDEX idx_applications_candidate ON applications(candidate_id);
      CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
      CREATE INDEX idx_durable_jobs_polling ON durable_jobs(status);
      CREATE INDEX idx_resumes_candidate ON resumes(candidate_id);
      CREATE INDEX idx_saved_jobs_candidate ON saved_jobs(candidate_id);
    `;

    const result = verifyBackupSql(unclosedTxSql);
    assert.equal(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes("Mismatched transaction blocks")));
  });

  it("CLI executable exits with 0 on valid schema", () => {
    const output = execFileSync("node", ["scripts/verify-backup.mjs", "src/lib/db/schema.sql"], {
      encoding: "utf8",
    });

    assert.ok(output.includes("PASSED"));
    assert.ok(output.includes("All enterprise tables and indexes verified"));
  });

  it("CLI executable exits with 1 on non-existent file", () => {
    assert.throws(() => {
      execFileSync("node", ["scripts/verify-backup.mjs", "non_existent_file.sql"], {
        encoding: "utf8",
        stdio: "pipe",
      });
    });
  });
});
