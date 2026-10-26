import { NextRequest, NextResponse } from "next/server";
import { getApplicationRepository, getJobRepository, getResumeRepository } from "@/lib/repository";
import { getAuthenticatedCandidate } from "@/lib/auth/session";
import { DatabaseUnavailableError, DatabaseConfigurationError } from "@/lib/db/postgres";

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedCandidate(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized: Candidate session required to view applications." },
        { status: 401 }
      );
    }

    const appRepo = getApplicationRepository();
    const applications = await appRepo.listByCandidate(auth.candidateId);

    return NextResponse.json({
      total: applications.length,
      applications,
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
        { error: "Unauthorized: Candidate session required to submit an application." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { jobId, resumeId, answers } = body;

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    // Verify target job exists
    const jobRepo = getJobRepository();
    const targetJob = await jobRepo.getById(jobId);
    if (!targetJob) {
      return NextResponse.json(
        { error: `Job opportunity "${jobId}" was not found or is no longer accepting applications.` },
        { status: 404 }
      );
    }

    // Verify candidate ownership of attached resume if specified
    if (resumeId) {
      const resumeRepo = getResumeRepository();
      const targetResume = await resumeRepo.getById(resumeId);
      if (!targetResume) {
        return NextResponse.json(
          { error: `Resume "${resumeId}" was not found.` },
          { status: 404 }
        );
      }
      if (targetResume.candidateId !== auth.candidateId) {
        return NextResponse.json(
          { error: "Forbidden: You cannot attach a resume belonging to another candidate." },
          { status: 403 }
        );
      }
    }

    // Always resolve candidate ID from verified server session, never trusting client payload
    const appRepo = getApplicationRepository();
    const result = await appRepo.submit({
      jobId,
      resumeId: resumeId || "res_1",
      answers: answers || {},
      candidateId: auth.candidateId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, application: result.application },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      application: result.application,
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
