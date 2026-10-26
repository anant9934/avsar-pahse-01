import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { extractAllJobsFromDataset } from "./normalization.ts";
import { createJobBatchKey } from "./deduplication.ts";
import type { Job } from "@/types";

export interface IngestionOptions {
  preview?: boolean;
  updateExisting?: boolean;
}

export interface IngestionReport {
  timestamp: string;
  sourceFile: string;
  totalDiscovered: number;
  created: number;
  updated: number;
  unchanged: number;
  duplicatesSkipped: number;
  rejected: number;
  errors: Array<{ index: number; error: string }>;
  previewMode: boolean;
  summary: string;
}

/**
 * Idempotently ingests the root jobs.json dataset into the Avsar database
 */
export function ingestJobsDataset(options: IngestionOptions = {}): IngestionReport {
  const rootDatasetPath = path.join(process.cwd(), "jobs.json");

  if (!fs.existsSync(rootDatasetPath)) {
    return {
      timestamp: new Date().toISOString(),
      sourceFile: "jobs.json",
      totalDiscovered: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      duplicatesSkipped: 0,
      rejected: 1,
      errors: [{ index: 0, error: "jobs.json file not found at repository root." }],
      previewMode: Boolean(options.preview),
      summary: "Failed: jobs.json not found.",
    };
  }

  const rawText = fs.readFileSync(rootDatasetPath, "utf-8");
  const { jobs: parsedJobs, errors, totalDiscovered } = extractAllJobsFromDataset(rawText);

  const existingJobs = db.getJobs();
  const existingJobMapById = new Map<string, Job>();
  const existingJobMapByCompanyRole = new Map<string, Job>();

  for (const ej of existingJobs) {
    existingJobMapById.set(ej.id, ej);
    const key = `${ej.company.trim().toLowerCase()}:::${ej.title.trim().toLowerCase()}`;
    existingJobMapByCompanyRole.set(key, ej);
  }

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let duplicatesSkipped = 0;

  const seenInBatch = new Set<string>();
  const toUpsert: Job[] = [];

  for (const job of parsedJobs) {
    const batchKey = `${job.company.trim().toLowerCase()}:::${job.title.trim().toLowerCase()}`;

    // Skip within-batch duplicate
    if (seenInBatch.has(batchKey)) {
      duplicatesSkipped++;
      continue;
    }
    seenInBatch.add(batchKey);

    // Look for existing match in DB
    const existing = existingJobMapById.get(job.id) || existingJobMapByCompanyRole.get(batchKey);

    if (!existing) {
      // New record
      createdCount++;
      toUpsert.push(job);
    } else {
      // Check if any normalized field changed
      const hasChanged =
        existing.compensation !== job.compensation ||
        existing.verificationStatus !== job.verificationStatus ||
        existing.isPossiblyClosed !== job.isPossiblyClosed ||
        existing.deadline !== job.deadline ||
        existing.applyUrl !== job.applyUrl ||
        (job.graduationYears && JSON.stringify(existing.graduationYears) !== JSON.stringify(job.graduationYears));

      if (hasChanged && options.updateExisting) {
        updatedCount++;
        // Preserve user modifications and internal state (e.g. isFeatured, heroImage)
        const merged: Job = {
          ...job,
          id: existing.id, // preserve existing ID so applications and bookmarks remain connected
          slug: existing.slug,
          isFeatured: existing.isFeatured ?? job.isFeatured,
          heroImage: existing.heroImage || job.heroImage,
        };
        toUpsert.push(merged);
      } else {
        unchangedCount++;
      }
    }
  }

  // If not in preview mode, commit changes to database
  if (!options.preview && (createdCount > 0 || updatedCount > 0)) {
    db.upsertJobsBatch(toUpsert);
  }

  return {
    timestamp: new Date().toISOString(),
    sourceFile: "jobs.json",
    totalDiscovered,
    created: createdCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    duplicatesSkipped,
    rejected: errors.length,
    errors: errors.slice(0, 20),
    previewMode: Boolean(options.preview),
    summary: options.preview
      ? `Preview completed: ${createdCount} new, ${updatedCount} would update, ${unchangedCount} unchanged, ${duplicatesSkipped} duplicates skipped, ${errors.length} rejected.`
      : `Ingestion completed: ${createdCount} created, ${updatedCount} updated, ${unchangedCount} unchanged, ${duplicatesSkipped} duplicates skipped, ${errors.length} rejected.`,
  };
}
