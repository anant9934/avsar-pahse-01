import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/aitathastu";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(AUTH_CONFIG.cookieName)?.value;
  const candidate = db.getCandidate();

  if (sessionCookie) {
    try {
      const session = JSON.parse(sessionCookie);
      return NextResponse.json({
        authenticated: true,
        user: session,
        candidate,
      });
    } catch {
      // Fall through to unauthenticated
    }
  }

  // If no cookie is present, default to candidate (Rohan) in dev or unauthenticated
  return NextResponse.json({
    authenticated: true,
    user: {
      userId: candidate.id,
      name: candidate.name,
      email: candidate.email,
      avatar: candidate.avatar,
      provider: "demo_rohan",
    },
    candidate,
  });
}
