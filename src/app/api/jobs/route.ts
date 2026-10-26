import { NextRequest, NextResponse } from "next/server";
import { getJobRepository, getCandidateRepository, getSavedJobRepository } from "@/lib/repository";
import { calculateJobMatch } from "@/lib/matching";
import { checkAdminAuth } from "@/lib/auth/admin";
import { getAuthenticatedCandidate } from "@/lib/auth/session";
import { DatabaseUnavailableError, DatabaseConfigurationError } from "@/lib/db/postgres";
import { cacheGetOrSet, cachePurgeTag, generateCacheKey } from "@/lib/cache";
import {
  extractOrCreateTraceContext,
  createTimer,
  recordMetric,
  injectTraceHeaders,
  formatServerTiming,
} from "@/lib/telemetry";

export async function GET(request: NextRequest) {
  const traceCtx = extractOrCreateTraceContext(request);
  const timer = createTimer(traceCtx);

  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q")?.toLowerCase().trim();
    const filter = searchParams.get("filter")?.toLowerCase().trim();
    const workArrangement = searchParams.get("arrangement")?.toLowerCase().trim();
    const employmentType = searchParams.get("type")?.toLowerCase().trim();
    const category = searchParams.get("category")?.toLowerCase().trim();
    const batchStr = searchParams.get("batch")?.trim();
    const verification = searchParams.get("verification")?.toUpperCase().trim();
    const status = searchParams.get("status")?.toLowerCase().trim(); // 'open' | 'all'
    const sort = searchParams.get("sort") || "recommended"; // 'recommended' | 'latest' | 'salary'
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(0, parseInt(searchParams.get("limit") || "0", 10)); // 0 means return all

    const jobRepo = getJobRepository();
    const candRepo = getCandidateRepository();
    const savedRepo = getSavedJobRepository();

    const cacheKey = generateCacheKey("jobs:raw", {
      q,
      workArrangement,
      employmentType,
      category,
      verification,
      status,
    });

    const { jobs: rawJobs } = await cacheGetOrSet(
      cacheKey,
      () =>
        jobRepo.list({
          q,
          workArrangement,
          employmentType,
          category,
          verification,
          status,
        }),
      { ttlSeconds: 60, tags: ["jobs"] }
    );

    const auth = getAuthenticatedCandidate(request);
    const candidateId = auth?.candidateId || "cand_rohan_sharma_001";
    const candidate =
      (await candRepo.getById(candidateId)) ||
      (await candRepo.getById("cand_rohan_sharma_001")) ||
      (await candRepo.listAll())[0];

    let jobs = rawJobs;

    // Additional in-memory filters for backwards compatibility
    if (batchStr && batchStr !== "all") {
      const batchYear = parseInt(batchStr, 10);
      if (!isNaN(batchYear)) {
        jobs = jobs.filter(
          (j) => !j.graduationYears || j.graduationYears.length === 0 || j.graduationYears.includes(batchYear)
        );
      }
    }

    if (filter && filter !== "all" && filter !== "for you") {
      if (filter === "remote") {
        jobs = jobs.filter((j) => j.workArrangement === "Remote");
      } else if (filter === "bengaluru") {
        jobs = jobs.filter((j) => j.location.toLowerCase().includes("bengaluru"));
      } else if (filter === "internship") {
        jobs = jobs.filter((j) => j.employmentType === "Internship");
      } else if (filter === "full-time" || filter === "full time") {
        jobs = jobs.filter((j) => j.employmentType === "Full Time");
      } else if (filter === "verified") {
        jobs = jobs.filter((j) => j.verificationStatus === "VERIFIED");
      } else if (filter.startsWith("batch-")) {
        const year = parseInt(filter.replace("batch-", ""), 10);
        if (!isNaN(year)) {
          jobs = jobs.filter(
            (j) => !j.graduationYears || j.graduationYears.length === 0 || j.graduationYears.includes(year)
          );
        }
      }
    }

    const savedIds = candidate ? await savedRepo.listByCandidate(candidate.id) : [];

    // Calculate deterministic match scores for all matching jobs
    const jobsWithMatch = jobs.map((job) => {
      const match = candidate ? calculateJobMatch(candidate, job) : { overallScore: 75, ratingLabel: "Good Match", eligibility: { isEligible: true, reason: "" } };
      const isSaved = savedIds.includes(job.id);
      return {
        ...job,
        matchScore: match.overallScore,
        matchLabel: match.ratingLabel,
        isEligible: match.eligibility.isEligible,
        eligibilityReason: match.eligibility.reason,
        isSaved,
      };
    });

    // Sort
    if (sort === "recommended") {
      jobsWithMatch.sort((a, b) => b.matchScore - a.matchScore);
    } else if (sort === "salary") {
      jobsWithMatch.sort((a, b) => {
        const aSal = a.salaryDetails?.min || 0;
        const bSal = b.salaryDetails?.min || 0;
        return bSal - aSal;
      });
    }

    const total = jobsWithMatch.length;

    // Pagination
    let paginatedJobs = jobsWithMatch;
    let totalPages = 1;
    let hasMore = false;

    if (limit > 0) {
      totalPages = Math.ceil(total / limit) || 1;
      const startIndex = (page - 1) * limit;
      paginatedJobs = jobsWithMatch.slice(startIndex, startIndex + limit);
      hasMore = page < totalPages;
    }

    const totalDuration = timer.getTotalDurationMs();
    recordMetric("jobs_query_duration", totalDuration);

    const headers = new Headers();
    injectTraceHeaders(headers, traceCtx);
    const serverTiming = formatServerTiming(timer.getSpans());
    if (serverTiming) headers.set("Server-Timing", serverTiming);

    return NextResponse.json(
      {
        total,
        page: limit > 0 ? page : 1,
        limit: limit > 0 ? limit : total,
        totalPages,
        hasMore,
        jobs: paginatedJobs,
      },
      { headers }
    );
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

export async function POST(request: NextRequest) {
  try {
    const auth = checkAdminAuth(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.reason || "Unauthorized: Admin privileges required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "Job title is required" }, { status: 400 });
    }
    if (!body.company || typeof body.company !== "string" || !body.company.trim()) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }
    if (!body.deadline || typeof body.deadline !== "string" || !body.deadline.trim()) {
      return NextResponse.json({ error: "Application deadline is required" }, { status: 400 });
    }

    const jobRepo = getJobRepository();
    const existing = await jobRepo.getById(body.id || "");
    if (existing) {
      return NextResponse.json(
        { error: `Job listing for "${body.title}" at "${body.company}" already exists.` },
        { status: 409 }
      );
    }

    const created = await jobRepo.create(body);
    await cachePurgeTag("jobs");
    return NextResponse.json({ success: true, job: created }, { status: 201 });
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
