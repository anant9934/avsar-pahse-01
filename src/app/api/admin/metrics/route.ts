import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getJobRepository, getApplicationRepository } from "@/lib/repository";
import { checkAdminAuth } from "@/lib/auth/admin";
import { DatabaseUnavailableError, DatabaseConfigurationError } from "@/lib/db/postgres";
import { cacheGetOrSet } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const auth = checkAdminAuth(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.reason || "Unauthorized" }, { status: 401 });
    }

    const metrics = await cacheGetOrSet(
      "metrics:admin_summary",
      async () => {
        const baseMetrics = db.getAdminMetrics();
        try {
          const jobRepo = getJobRepository();
          const appRepo = getApplicationRepository();
          const totalJobs = await jobRepo.count();
          const allApps = await appRepo.listAll();

          baseMetrics.totalJobs = totalJobs;
          baseMetrics.applicationsCount = allApps.length;
        } catch {
          // Best-effort metrics enrichment
        }
        return baseMetrics;
      },
      { ttlSeconds: 30, tags: ["metrics"] }
    );

    return NextResponse.json({ metrics });
  } catch (err: unknown) {
    if (err instanceof DatabaseUnavailableError || err instanceof DatabaseConfigurationError) {
      return NextResponse.json(
        { error: "Database service temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
