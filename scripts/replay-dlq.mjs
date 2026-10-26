#!/usr/bin/env node

/**
 * Avsar Operational SRE Tool: Dead-Letter Queue (DLQ) Inspector & Replay CLI
 *
 * Usage:
 *   node scripts/replay-dlq.mjs --summary
 *   node scripts/replay-dlq.mjs --inspect [--type=audit_log] [--limit=10]
 *   node scripts/replay-dlq.mjs --replay [--type=notification] [--limit=50] [--dry-run]
 */

import {
  listDeadLetterJobs,
  getDeadLetterSummary,
  replayDeadLetterBatch,
} from "../src/lib/queue/dead-letter.ts";
import { isPostgresConfigured, maskConnectionString } from "../src/lib/db/postgres.ts";

function parseArgs(args) {
  const flags = {
    summary: false,
    inspect: false,
    replay: false,
    dryRun: false,
    type: null,
    limit: 50,
  };

  for (const arg of args) {
    if (arg === "--summary") flags.summary = true;
    else if (arg === "--inspect") flags.inspect = true;
    else if (arg === "--replay") flags.replay = true;
    else if (arg === "--dry-run") flags.dryRun = true;
    else if (arg.startsWith("--type=")) flags.type = arg.split("=")[1];
    else if (arg.startsWith("--limit=")) flags.limit = parseInt(arg.split("=")[1], 10) || 50;
  }

  return flags;
}

export async function runDlqCli(argv = process.argv.slice(2)) {
  const flags = parseArgs(argv);

  console.log("==================================================================");
  console.log(" AVSAR OPERATIONAL TOOL: DEAD-LETTER QUEUE RECOVERY & REPLAY");
  console.log("==================================================================");
  console.log(`Database Configured: ${isPostgresConfigured() ? "YES" : "NO (Mock / Local)"}`);
  if (process.env.DATABASE_URL) {
    console.log(`Target Database:     ${maskConnectionString(process.env.DATABASE_URL)}`);
  }
  console.log("------------------------------------------------------------------");

  if (flags.summary || (!flags.inspect && !flags.replay)) {
    const summary = await getDeadLetterSummary();
    console.log(`Total Failed Jobs in DLQ: ${summary.totalFailed}`);
    console.log("Failures by Job Type:");
    if (Object.keys(summary.byType).length === 0) {
      console.log("  (None)");
    } else {
      for (const [type, count] of Object.entries(summary.byType)) {
        console.log(`  - ${type}: ${count}`);
      }
    }

    console.log("\nTop Failure Reasons:");
    if (summary.commonReasons.length === 0) {
      console.log("  (None)");
    } else {
      for (const r of summary.commonReasons) {
        console.log(`  - [${r.count}x] ${r.reason}`);
      }
    }
    console.log("------------------------------------------------------------------");
  }

  if (flags.inspect) {
    const jobs = await listDeadLetterJobs({
      type: flags.type || undefined,
      limit: flags.limit,
    });

    console.log(`Inspecting ${jobs.length} DLQ jobs (filter: type=${flags.type || "ALL"}, limit=${flags.limit}):\n`);
    for (const job of jobs) {
      console.log(`ID:        ${job.id}`);
      console.log(`Type:      ${job.type} (Priority: ${job.priority})`);
      console.log(`Attempts:  ${job.attempts}/${job.maxAttempts}`);
      console.log(`Reason:    ${job.failedReason || "None recorded"}`);
      console.log(`Failed At: ${job.updatedAt.toISOString()}`);
      console.log("---");
    }
  }

  if (flags.replay) {
    if (flags.dryRun) {
      console.log(`[DRY-RUN] Would replay up to ${flags.limit} failed jobs (type: ${flags.type || "ALL"})`);
      return { success: true, replayed: 0, dryRun: true };
    }

    const replayed = await replayDeadLetterBatch({
      type: flags.type || undefined,
      limit: flags.limit,
    });

    console.log(`[SUCCESS] Replayed ${replayed} failed jobs back to 'pending' status for retry.`);
    return { success: true, replayed, dryRun: false };
  }

  return { success: true };
}

// Direct execution guard
const isDirectExecution = process.argv[1]?.endsWith("replay-dlq.mjs");
if (isDirectExecution) {
  runDlqCli().catch((err) => {
    console.error("DLQ Replay CLI error:", err);
    process.exit(1);
  });
}
