#!/usr/bin/env node

/**
 * Automated Daily Maintenance & Data Retention Task
 * 
 * Executes scheduled database pruning for expired idempotency keys,
 * completed background queue jobs, and aged audit events per compliance policy.
 */

import { getPgPool, isPostgresConfigured } from "../src/lib/db/postgres.ts";

/**
 * @typedef {Object} MaintenanceResult
 * @property {number} expiredIdempotencyKeysPurged
 * @property {number} completedJobsPurged
 * @property {number} agedAuditLogsPurged
 * @property {boolean} isDryRun
 */

/**
 * Executes database cleanup and maintenance tasks.
 * @param {import('pg').Pool} [pool]
 * @param {Object} [options]
 * @param {boolean} [options.dryRun]
 * @returns {Promise<MaintenanceResult>}
 */
export async function runDailyMaintenance(pool, options = {}) {
  const isDryRun = options.dryRun ?? false;

  if (!pool && !isPostgresConfigured()) {
    return {
      expiredIdempotencyKeysPurged: 0,
      completedJobsPurged: 0,
      agedAuditLogsPurged: 0,
      isDryRun,
    };
  }

  const activePool = pool || getPgPool();

  if (isDryRun) {
    // Inspect count of eligible records without deleting
    const idempRes = await activePool.query(
      `SELECT count(*)::int AS count FROM idempotency_keys WHERE expires_at < NOW()`
    );
    const jobsRes = await activePool.query(
      `SELECT count(*)::int AS count FROM durable_jobs WHERE status = 'completed' AND updated_at < NOW() - INTERVAL '7 days'`
    );
    const auditRes = await activePool.query(
      `SELECT count(*)::int AS count FROM audit_events WHERE created_at < NOW() - INTERVAL '365 days'`
    );

    return {
      expiredIdempotencyKeysPurged: idempRes.rows[0]?.count || 0,
      completedJobsPurged: jobsRes.rows[0]?.count || 0,
      agedAuditLogsPurged: auditRes.rows[0]?.count || 0,
      isDryRun: true,
    };
  }

  // 1. Purge expired idempotency keys
  const idempDelete = await activePool.query(
    `DELETE FROM idempotency_keys WHERE expires_at < NOW()`
  );

  // 2. Purge completed durable queue jobs
  const jobsDelete = await activePool.query(
    `DELETE FROM durable_jobs WHERE status = 'completed' AND updated_at < NOW() - INTERVAL '7 days'`
  );

  // 3. Purge aged audit logs older than 365 days
  const auditDelete = await activePool.query(
    `DELETE FROM audit_events WHERE created_at < NOW() - INTERVAL '365 days'`
  );

  return {
    expiredIdempotencyKeysPurged: idempDelete.rowCount ?? 0,
    completedJobsPurged: jobsDelete.rowCount ?? 0,
    agedAuditLogsPurged: auditDelete.rowCount ?? 0,
    isDryRun: false,
  };
}

/**
 * CLI runner
 */
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  console.log(`[Daily Maintenance] Running maintenance task (Dry Run: ${isDryRun})...`);

  try {
    const result = await runDailyMaintenance(undefined, { dryRun: isDryRun });
    console.log(`[Daily Maintenance] Summary:`);
    console.log(`  - Expired Idempotency Keys: ${result.expiredIdempotencyKeysPurged}`);
    console.log(`  - Completed Durable Jobs (>7d): ${result.completedJobsPurged}`);
    console.log(`  - Aged Audit Logs (>365d): ${result.agedAuditLogsPurged}`);
    console.log(`[Daily Maintenance] Maintenance completed successfully.`);
    process.exit(0);
  } catch (err) {
    console.error(`[Daily Maintenance] Maintenance task failed:`, err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith("daily-maintenance.mjs")) {
  main().catch((err) => {
    console.error("[Daily Maintenance] Fatal error:", err);
    process.exit(1);
  });
}
