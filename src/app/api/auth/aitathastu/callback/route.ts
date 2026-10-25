import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG, exchangeCodeForProfile } from "@/lib/auth/aitathastu";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const storedState = request.cookies.get(AUTH_CONFIG.stateCookieName)?.value;
  const storedVerifier = request.cookies.get(AUTH_CONFIG.verifierCookieName)?.value;

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/auth?error=${encodeURIComponent(error)}&message=${encodeURIComponent(
          errorDescription || "Authentication was rejected or cancelled"
        )}`,
        request.url
      )
    );
  }

  if (!code || !state || !storedState || state !== storedState || !storedVerifier) {
    return NextResponse.redirect(
      new URL(
        `/auth?error=invalid_state&message=${encodeURIComponent(
          "OAuth 2.0 PKCE state verification failed or session expired. Please try again."
        )}`,
        request.url
      )
    );
  }

  // Perform server-to-server token exchange with AI Tathastu IdP
  const result = await exchangeCodeForProfile(code, storedVerifier);

  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/auth?error=token_error&message=${encodeURIComponent(result.error)}`, request.url)
    );
  }

  const profile = result.profile;

  // Provision or sync candidate profile in local database
  const candidate = db.getCandidate();
  db.updateCandidate({
    aiTathastuId: profile.sub,
    email: profile.email || candidate.email,
    name: profile.name || candidate.name,
  });

  const response = NextResponse.redirect(new URL("/home", request.url));

  // Set authenticated HTTP-only session cookie
  response.cookies.set({
    name: AUTH_CONFIG.cookieName,
    value: JSON.stringify({
      userId: candidate.id,
      aiTathastuId: profile.sub,
      name: profile.name || candidate.name,
      email: profile.email || candidate.email,
      avatar: candidate.avatar,
      provider: "ai_tathastu",
      createdAt: Date.now(),
    }),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
  });

  // Clean up transient OAuth cookies
  response.cookies.delete(AUTH_CONFIG.stateCookieName);
  response.cookies.delete(AUTH_CONFIG.verifierCookieName);

  return response;
}
