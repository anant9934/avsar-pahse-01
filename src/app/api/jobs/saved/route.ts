import { NextRequest, NextResponse } from "next/server";
import { getSavedJobRepository, getJobRepository } from "@/lib/repository";
import { getAuthenticatedCandidate } from "@/lib/auth/session";
import { DatabaseUnavailableError, DatabaseConfigurationError } from "@/lib/db/postgres";

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedCandidate(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized: Candidate session required to view saved jobs." },
        { status: 401 }
      );
    }

    const savedRepo = getSavedJobRepository();
    const jobRepo = getJobRepository();

    const savedJobIds = await savedRepo.listByCandidate(auth.candidateId);
    const { jobs: allJobs } = await jobRepo.list();
    const savedJobs = allJobs.filter((j) => savedJobIds.includes(j.id));

    return NextResponse.json({
      savedJobIds,
      savedJobs,
    });
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
    const auth = getAuthenticatedCandidate(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized: Candidate session required to save jobs." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const jobId = body.jobId;
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const savedRepo = getSavedJobRepository();
    const result = await savedRepo.toggle(auth.candidateId, jobId);
    return NextResponse.json(result);
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
