import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { getCandidateRepository } from "@/lib/repository";
import { DatabaseUnavailableError, DatabaseConfigurationError } from "@/lib/db/postgres";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (sessionCookie) {
      const session = verifySessionToken(sessionCookie);
      if (session && session.userId) {
        const candRepo = getCandidateRepository();
        const candidate = await candRepo.getById(session.userId);
        return NextResponse.json({
          authenticated: true,
          user: session,
          candidate,
        });
      }
    }

    // If no valid session cookie is present, return safe unauthenticated status
    return NextResponse.json({
      authenticated: false,
      user: null,
      candidate: null,
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
