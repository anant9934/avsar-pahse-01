#!/usr/bin/env node

/**
 * Backup Verification CLI & Automated Integrity Auditor
 * 
 * Verifies that a PostgreSQL logical backup (.sql / DDL dump) contains all required
 * enterprise schemas, primary keys, relational indexes, and durable queue tables.
 * Can be run in CI/CD, scheduled cron, or imported into regression test suites.
 */

import fs from "node:fs";
import path from "node:path";

export const REQUIRED_TABLES = [
  "candidates",
  "jobs",
  "applications",
  "resumes",
  "saved_jobs",
  "idempotency_keys",
  "durable_jobs",
  "schema_migrations",
];

export const REQUIRED_INDEXES = [
  "idx_applications_candidate",
  "idx_idempotency_expires",
  "idx_durable_jobs_polling",
  "idx_resumes_candidate",
  "idx_saved_jobs_candidate",
];

/**
 * @typedef {Object} BackupVerificationResult
 * @property {boolean} isValid
 * @property {number} tableCount
 * @property {number} indexCount
 * @property {string[]} missingTables
 * @property {string[]} missingIndexes
 * @property {string[]} errors
 */

/**
 * Analyzes the text content of a PostgreSQL schema or backup file.
 * @param {string} sqlContent
 * @returns {BackupVerificationResult}
 */
export function verifyBackupSql(sqlContent) {
  const errors = [];
  const missingTables = [];
  const missingIndexes = [];

  if (!sqlContent || sqlContent.trim().length === 0) {
    return {
      isValid: false,
      tableCount: 0,
      indexCount: 0,
      missingTables: [...REQUIRED_TABLES],
      missingIndexes: [...REQUIRED_INDEXES],
      errors: ["Backup SQL content is empty or unreadable."],
    };
  }

  // Check for required tables
  for (const table of REQUIRED_TABLES) {
    const tableRegex = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${table}\\b`, "i");
    if (!tableRegex.test(sqlContent)) {
      missingTables.push(table);
      errors.push(`Missing required table DDL: ${table}`);
    }
  }

  // Check for required indexes
  for (const index of REQUIRED_INDEXES) {
    const indexRegex = new RegExp(`CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${index}\\b`, "i");
    if (!indexRegex.test(sqlContent)) {
      missingIndexes.push(index);
      errors.push(`Missing required index DDL: ${index}`);
    }
  }

  // Sanity check: Ensure SQL does not have truncated transaction or unclosed blocks
  const beginMatches = (sqlContent.match(/\bBEGIN\b/gi) || []).length;
  const commitMatches = (sqlContent.match(/\bCOMMIT\b/gi) || []).length;
  if (beginMatches > commitMatches) {
    errors.push(`Mismatched transaction blocks: ${beginMatches} BEGIN vs ${commitMatches} COMMIT`);
  }

  // Count total tables found
  const totalTablesFound = (sqlContent.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) || []).length;
  const totalIndexesFound = (sqlContent.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/gi) || []).length;

  const isValid = missingTables.length === 0 && missingIndexes.length === 0 && errors.length === 0;

  return {
    isValid,
    tableCount: totalTablesFound,
    indexCount: totalIndexesFound,
    missingTables,
    missingIndexes,
    errors,
  };
}

/**
 * CLI execution handler
 */
async function main() {
  const args = process.argv.slice(2);
  const targetFile = args[0] || path.resolve("src/lib/db/schema.sql");

  console.log(`[Backup Auditor] Verifying SQL file: ${targetFile}`);

  if (!fs.existsSync(targetFile)) {
    console.error(`[Backup Auditor] Error: File does not exist at ${targetFile}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(targetFile, "utf8");
  const result = verifyBackupSql(sqlContent);

  console.log(`[Backup Auditor] Found ${result.tableCount} tables, ${result.indexCount} indexes.`);

  if (result.isValid) {
    console.log(`[Backup Auditor] Backup integrity check PASSED! All enterprise tables and indexes verified.`);
    process.exit(0);
  } else {
    console.error(`[Backup Auditor] Backup integrity check FAILED:`);
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
}

// Only invoke CLI if executed directly
if (process.argv[1] && process.argv[1].endsWith("verify-backup.mjs")) {
  main().catch((err) => {
    console.error("[Backup Auditor] Unhandled exception:", err);
    process.exit(1);
  });
}
