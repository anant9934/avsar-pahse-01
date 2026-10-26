import { NextRequest, NextResponse } from "next/server";
import { getJobRepository, getCandidateRepository, getSavedJobRepository } from "@/lib/repository";
import { calculateJobMatch } from "@/lib/matching";
import { getAuthenticatedCandidate } from "@/lib/auth/session";
import { DatabaseUnavailableError, DatabaseConfigurationError } from "@/lib/db/postgres";
import { cacheGetOrSet, generateETag, isNotModified, buildCacheControlHeader } from "@/lib/cache";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const jobRepo = getJobRepository();
    const candRepo = getCandidateRepository();
    const savedRepo = getSavedJobRepository();

    const job = await cacheGetOrSet(
      `job:${id}`,
      () => jobRepo.getById(id),
      { ttlSeconds: 300, tags: ["jobs", `job:${id}`] }
    );
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const auth = getAuthenticatedCandidate(request);
    const candidateId = auth?.candidateId || "cand_rohan_sharma_001";
    const candidate =
      (await candRepo.getById(candidateId)) ||
      (await candRepo.getById("cand_rohan_sharma_001")) ||
      (await candRepo.listAll())[0];

    const match = candidate
      ? calculateJobMatch(candidate, job)
      : { overallScore: 75, ratingLabel: "Good Match", eligibility: { isEligible: true, reason: "" } };
    const isSaved = candidate ? await savedRepo.isSaved(candidate.id, job.id) : false;

    const responsePayload = {
      job,
      match,
      isSaved,
    };

    const headers = new Headers();
    const etag = generateETag(responsePayload);
    headers.set("ETag", etag);

    if (auth) {
      headers.set("Cache-Control", buildCacheControlHeader({ isPrivate: true }));
    } else {
      headers.set(
        "Cache-Control",
        buildCacheControlHeader({ maxAge: 30, sMaxAge: 300, staleWhileRevalidate: 600 })
      );
    }

    if (isNotModified(request.headers, etag)) {
      return new NextResponse(null, { status: 304, headers });
    }

    return NextResponse.json(responsePayload, { headers });
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
