import { NextRequest, NextResponse } from "next/server";
import { getCandidateRepository } from "@/lib/repository";
import { getAuthenticatedCandidate } from "@/lib/auth/session";
import { DatabaseUnavailableError, DatabaseConfigurationError } from "@/lib/db/postgres";

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthenticatedCandidate(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized: Candidate session required to view profile." },
        { status: 401 }
      );
    }

    const candRepo = getCandidateRepository();
    const candidate = await candRepo.getById(auth.candidateId);

    return NextResponse.json({
      candidate,
      authenticated: auth.authenticated,
      user: auth.user,
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

export async function PATCH(request: NextRequest) {
  try {
    const auth = getAuthenticatedCandidate(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized: Candidate session required to update profile." },
        { status: 401 }
      );
    }

    const updates = await request.json();

    // Prevent client from overwriting immutable identity keys
    delete updates.id;
    delete updates.aiTathastuId;

    const candRepo = getCandidateRepository();
    const updated = await candRepo.update(auth.candidateId, updates);

    return NextResponse.json({ success: true, candidate: updated });
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
