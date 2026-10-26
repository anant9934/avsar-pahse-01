import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG, buildAuthorizeUrl, generatePKCE } from "@/lib/auth/aitathastu";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sanitizeReturnTo,
  signSessionPayload,
} from "@/lib/auth/session";
import { db } from "@/lib/db";
import { enforceRateLimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse as NextResponse;

  const searchParams = request.nextUrl.searchParams;
  const demo = searchParams.get("demo");
  const provider = searchParams.get("provider") as "google" | "email" | null;
  const rawReturnTo = searchParams.get("return_to") || searchParams.get("returnTo");

  // Strict same-origin relative path validation
  const returnTo = sanitizeReturnTo(rawReturnTo, "/home");

  // Fast demo sign-in: strictly restricted to development or when ALLOW_DEMO_AUTH is true
  if (demo === "rohan" || demo === "true") {
    const isDemoAllowed =
      process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_AUTH === "true";

    if (!isDemoAllowed) {
      return NextResponse.json(
        { error: "Demo authentication is disabled in production environments." },
        { status: 403 }
      );
    }

    const defaultCandidate = db.getCandidate();
    const sessionToken = signSessionPayload({
      userId: defaultCandidate.id,
      aiTathastuId: defaultCandidate.aiTathastuId,
      name: defaultCandidate.name,
      email: defaultCandidate.email,
      avatar: defaultCandidate.avatar,
      role: "candidate",
      provider: "demo_rohan",
      createdAt: Date.now(),
    });

    const response = NextResponse.redirect(new URL(returnTo, request.url));
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      sameSite: "lax",
    });
    return response;
  }

  // Live OAuth 2.0 PKCE flow
  const { verifier, challenge, state } = generatePKCE();

  const authUrl = buildAuthorizeUrl({
    challenge,
    state,
    providerHint: provider || undefined,
    returnTo,
  });

  const response = NextResponse.redirect(authUrl);

  // Store verifier, state, and verified return_to in temporary secure HTTP-only cookies
  response.cookies.set({
    name: AUTH_CONFIG.stateCookieName,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 minutes single-use
    sameSite: "lax",
  });

  response.cookies.set({
    name: AUTH_CONFIG.verifierCookieName,
    value: verifier,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
    sameSite: "lax",
  });

  response.cookies.set({
    name: AUTH_CONFIG.returnToCookieName,
    value: returnTo,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
    sameSite: "lax",
  });

  return response;
}
