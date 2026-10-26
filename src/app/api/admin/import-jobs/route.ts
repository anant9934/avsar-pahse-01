import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getJobRepository, getAuditRepository } from "@/lib/repository";
import { checkAdminAuth } from "@/lib/auth/admin";
import { ingestJobsDataset } from "@/lib/jobs/ingestion";
import { normalizeJobRecord } from "@/lib/jobs/normalization";
import type { Job } from "@/types";
import { DatabaseUnavailableError, DatabaseConfigurationError } from "@/lib/db/postgres";
import { cachePurgeTag } from "@/lib/cache";

export async function POST(request: NextRequest) {
  try {
    // 1. Authorize administrator
    const auth = checkAdminAuth(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.reason || "Unauthorized: Admin privileges required" },
        { status: 401 }
      );
    }

    let payload: Record<string, unknown> | unknown[] | null = null;
    try {
      payload = (await request.json()) as Record<string, unknown> | unknown[];
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON format: Could not parse request body." },
        { status: 400 }
      );
    }

    // Check if client requested ingesting the root jobs.json dataset directly
    const isRootAction =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      (payload.action === "ingest_root" || payload.action === "sync_dataset");

    const searchParams = request.nextUrl.searchParams;
    const isPreview =
      Boolean(searchParams.get("preview") === "true") ||
      (payload && typeof payload === "object" && !Array.isArray(payload) && Boolean(payload.preview));
    const shouldUpdate =
      Boolean(searchParams.get("update") === "true") ||
      (payload && typeof payload === "object" && !Array.isArray(payload) && Boolean(payload.updateExisting));

    if (isRootAction) {
      const report = ingestJobsDataset({
        preview: isPreview,
        updateExisting: shouldUpdate,
      });

      try {
        const auditRepo = getAuditRepository();
        await auditRepo.logEvent({
          actorType: "admin",
          actorId: "admin",
          action: "ingest_root_dataset",
          resourceType: "jobs",
          metadata: { preview: isPreview, update: shouldUpdate, created: report.created },
        });
      } catch {
        // Audit log best-effort
      }

      if (!isPreview) {
        await cachePurgeTag("jobs");
        await cachePurgeTag("metrics");
      }

      return NextResponse.json({
        success: true,
        action: "ingest_root",
        ...report,
      });
    }

    // Otherwise, process custom uploaded jobs array or { jobs: [...] }
    let rawItems: unknown[] = [];
    if (Array.isArray(payload)) {
      rawItems = payload;
    } else if (payload && typeof payload === "object" && Array.isArray((payload as { jobs?: unknown[] }).jobs)) {
      rawItems = (payload as { jobs: unknown[] }).jobs;
    } else {
      return NextResponse.json(
        {
          error:
            "Invalid format: Payload must be a JSON array of job listings, { jobs: [...] }, or { action: 'ingest_root' }.",
        },
        { status: 400 }
      );
    }

    if (rawItems.length === 0) {
      return NextResponse.json(
        { error: "Payload array is empty. No jobs to import." },
        { status: 400 }
      );
    }

    const jobRepo = getJobRepository();
    const { jobs: existingJobs } = await jobRepo.list();
    const existingMap = new Map<string, Job>();
    for (const ej of existingJobs) {
      const key = `${ej.company.trim().toLowerCase()}:::${ej.title.trim().toLowerCase()}`;
      existingMap.set(key, ej);
    }

    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let duplicatesSkipped = 0;
    const errors: Array<{ index: number; error: string }> = [];
    const jobsToUpsert: Job[] = [];
    const previewList: Array<{ title: string; company: string; status: string }> = [];
    const seenInBatch = new Set<string>();

    for (let i = 0; i < rawItems.length; i++) {
      const raw = rawItems[i];
      if (!raw || typeof raw !== "object") {
        errors.push({ index: i, error: "Item is not a valid JSON object." });
        continue;
      }

      const { job, error } = normalizeJobRecord(raw as Record<string, unknown>, 0);
      if (error || !job) {
        errors.push({ index: i, error: error || "Normalization failed." });
        continue;
      }

      const key = `${job.company.trim().toLowerCase()}:::${job.title.trim().toLowerCase()}`;

      if (seenInBatch.has(key)) {
        duplicatesSkipped++;
        previewList.push({ title: job.title, company: job.company, status: "duplicate_in_batch" });
        continue;
      }
      seenInBatch.add(key);

      const existing = existingMap.get(key) || existingJobs.find((j) => j.id === job.id);

      if (!existing) {
        createdCount++;
        jobsToUpsert.push(job);
        previewList.push({ title: job.title, company: job.company, status: "created" });
      } else {
        if (shouldUpdate) {
          updatedCount++;
          const merged: Job = {
            ...job,
            id: existing.id,
            slug: existing.slug,
            isFeatured: existing.isFeatured ?? job.isFeatured,
          };
          jobsToUpsert.push(merged);
          previewList.push({ title: job.title, company: job.company, status: "updated" });
        } else {
          unchangedCount++;
          duplicatesSkipped++;
          previewList.push({ title: job.title, company: job.company, status: "unchanged" });
        }
      }
    }

    if (!isPreview && jobsToUpsert.length > 0) {
      await jobRepo.upsertBatch(jobsToUpsert);
      // Keep db in sync if in local mode
      try {
        db.upsertJobsBatch(jobsToUpsert);
      } catch {
        // ignore
      }

      try {
        const auditRepo = getAuditRepository();
        await auditRepo.logEvent({
          actorType: "admin",
          actorId: "admin",
          action: "batch_import_jobs",
          resourceType: "jobs",
          metadata: { created: createdCount, updated: updatedCount, totalProcessed: rawItems.length },
        });
      } catch {
        // Audit log best-effort
      }

      if (!isPreview && (createdCount > 0 || updatedCount > 0)) {
        await cachePurgeTag("jobs");
        await cachePurgeTag("metrics");
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      previewMode: isPreview,
      totalProcessed: rawItems.length,
      importedCount: createdCount,
      created: createdCount,
      updated: updatedCount,
      unchanged: unchangedCount,
      duplicatesSkipped,
      rejected: errors.length,
      errors: errors.slice(0, 20),
      previewList: previewList.slice(0, 25),
      summary: isPreview
        ? `Preview: ${createdCount} new, ${updatedCount} would update, ${unchangedCount} unchanged, ${duplicatesSkipped} duplicates, ${errors.length} rejected.`
        : `Import completed: ${createdCount} created, ${updatedCount} updated, ${unchangedCount} unchanged, ${duplicatesSkipped} duplicates, ${errors.length} rejected.`,
    });
  } catch (err: unknown) {
    if (err instanceof DatabaseUnavailableError || err instanceof DatabaseConfigurationError) {
      return NextResponse.json(
        { error: "Database service temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
