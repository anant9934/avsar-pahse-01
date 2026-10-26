import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG, exchangeCodeForProfile } from "@/lib/auth/aitathastu";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sanitizeReturnTo,
  signSessionPayload,
} from "@/lib/auth/session";
import { getCandidateRepository } from "@/lib/repository";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const stateCookie = AUTH_CONFIG.stateCookieName || "avsar_oauth_state";
  const verifierCookie = AUTH_CONFIG.verifierCookieName || "avsar_oauth_verifier";
  const returnToCookie = AUTH_CONFIG.returnToCookieName || "avsar_oauth_return_to";

  const storedState = request.cookies.get(stateCookie)?.value;
  const storedVerifier = request.cookies.get(verifierCookie)?.value;
  const storedReturnTo = request.cookies.get(returnToCookie)?.value;

  const returnTo = sanitizeReturnTo(storedReturnTo, "/home");

  // Helper to create redirect response with cleaned up transient OAuth cookies
  const createCleanRedirect = (url: URL) => {
    const res = NextResponse.redirect(url);
    res.cookies.delete(stateCookie);
    res.cookies.delete(verifierCookie);
    res.cookies.delete(returnToCookie);
    return res;
  };

  // 1. Handle IdP-reported authorization errors (e.g. user denied consent)
  if (error) {
    const isConsentDenied = error === "access_denied" || error === "consent_denied";
    const userMessage = isConsentDenied
      ? "AI Tathastu authorization or consent was denied. Please accept permissions to continue."
      : errorDescription || "Authentication was rejected or cancelled.";

    const redirectUrl = new URL("/auth", request.url);
    redirectUrl.searchParams.set("error", isConsentDenied ? "consent_denied" : error);
    redirectUrl.searchParams.set("message", userMessage);
    return createCleanRedirect(redirectUrl);
  }

  // 2. State & PKCE verifier validation (single-use, prevents CSRF & replay)
  if (!code || !state || !storedState || state !== storedState || !storedVerifier) {
    const redirectUrl = new URL("/auth", request.url);
    redirectUrl.searchParams.set("error", "invalid_state");
    redirectUrl.searchParams.set(
      "message",
      "OAuth 2.0 PKCE state verification failed or authorization request expired. Please try again."
    );
    return createCleanRedirect(redirectUrl);
  }

  // 3. Server-to-server token exchange and cryptographic verification
  const result = await exchangeCodeForProfile(code, storedVerifier);

  if (!result.ok) {
    const redirectUrl = new URL("/auth", request.url);
    if (result.isAccountDisabled) {
      redirectUrl.searchParams.set("error", "account_disabled");
      redirectUrl.searchParams.set(
        "message",
        "Your AI Tathastu account is disabled, suspended, or inactive. Please contact support."
      );
    } else {
      redirectUrl.searchParams.set("error", result.code || "token_error");
      redirectUrl.searchParams.set("message", result.error);
    }
    return createCleanRedirect(redirectUrl);
  }

  const profile = result.profile;

  // 4. Stable external identity mapping (Keyed strictly by profile.sub UUID, never by email)
  const candRepo = getCandidateRepository();
  let candidate = await candRepo.getByTathastuId(profile.sub);

  if (!candidate) {
    // New AI Tathastu user entering Avsar for the first time
    // Note: Do not merge with existing accounts solely based on email match
    candidate = await candRepo.create({
      aiTathastuId: profile.sub,
      name: profile.name || "AI Tathastu Member",
      email: profile.email || "",
      avatar: profile.avatar || "/images/avatar-rohan.jpg",
    });
  } else {
    // Returning user: sync profile details (including updated email if changed at IdP)
    candidate = await candRepo.update(candidate.id, {
      name: profile.name || candidate.name,
      email: profile.email || candidate.email,
      avatar: profile.avatar || candidate.avatar,
    });
  }

  // 5. Create cryptographically signed Avsar application session
  const sessionToken = signSessionPayload({
    userId: candidate.id,
    aiTathastuId: profile.sub,
    name: candidate.name,
    email: candidate.email,
    avatar: candidate.avatar,
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  });

  // Determine post-login destination: preserve safe deep link
  const destinationUrl = new URL(returnTo, request.url);
  const response = NextResponse.redirect(destinationUrl);

  // Set secure, HTTP-only, SameSite session cookie
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    sameSite: "lax",
  });

  // Clean up transient OAuth authorization cookies
  response.cookies.delete(stateCookie);
  response.cookies.delete(verifierCookie);
  response.cookies.delete(returnToCookie);

  return response;
}
