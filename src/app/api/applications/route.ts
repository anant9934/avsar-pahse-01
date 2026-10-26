import { NextRequest, NextResponse } from "next/server";
import { getApplicationRepository, getJobRepository, getResumeRepository } from "@/lib/repository";
import { getAuthenticatedCandidate } from "@/lib/auth/session";
import { DatabaseUnavailableError, DatabaseConfigurationError } from "@/lib/db/postgres";
import { enforceRateLimit } from "@/lib/ratelimit";
import {
  withIdempotency,
  IdempotencyConflictError,
  IdempotencyMismatchError,
} from "@/lib/idempotency";

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
    const rateLimitResponse = await enforceRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse as NextResponse;

    const auth = getAuthenticatedCandidate(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized: Candidate session required to submit an application." },
        { status: 401 }
      );
    }

    const idempotencyKey =
      request.headers.get("idempotency-key") ||
      request.headers.get("x-idempotency-key");

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

    // Execute application submission protected by idempotency framework
    const appRepo = getApplicationRepository();
    const payload = {
      jobId,
      resumeId: resumeId || "res_1",
      answers: answers || {},
      candidateId: auth.candidateId,
    };

    const result = await withIdempotency<{
      success?: boolean;
      error?: string;
      application?: unknown;
    }>({
      key: idempotencyKey,
      scope: "application_submission",
      payload,
      candidateId: auth.candidateId,
      operation: async () => {
        const submission = await appRepo.submit(payload);

        if (!submission.success) {
          return {
            status: 409,
            body: { error: submission.error, application: submission.application },
          };
        }

        return {
          status: 200,
          body: {
            success: true,
            application: submission.application,
          },
        };
      },
    });

    const headers: Record<string, string> = {};
    if (result.replayed) {
      headers["X-Idempotent-Replay"] = "true";
    }

    return NextResponse.json(result.body, {
      status: result.status,
      headers,
    });
  } catch (err: unknown) {
    if (err instanceof IdempotencyConflictError) {
      return NextResponse.json(
        { error: "A submission with this Idempotency-Key is currently in progress. Please retry after a moment." },
        { status: 409 }
      );
    }
    if (err instanceof IdempotencyMismatchError) {
      return NextResponse.json(
        { error: "Idempotency-Key was previously used with a different application payload." },
        { status: 422 }
      );
    }
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
