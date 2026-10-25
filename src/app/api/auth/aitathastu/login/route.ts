import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG, buildAuthorizeUrl, generatePKCE } from "@/lib/auth/aitathastu";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const demo = searchParams.get("demo");
  const provider = searchParams.get("provider") as "google" | "email" | null;
  const returnTo = searchParams.get("return_to") || "/home";

  // Fast demo sign-in for seamless verification without external IdP deployment
  if (demo === "rohan" || demo === "true") {
    const response = NextResponse.redirect(new URL(returnTo, request.url));
    response.cookies.set({
      name: AUTH_CONFIG.cookieName,
      value: JSON.stringify({
        userId: "cand_rohan_sharma_001",
        name: "Rohan Sharma",
        email: "rohan@example.com",
        avatar: "/images/avatar-rohan.jpg",
        provider: "demo_rohan",
        createdAt: Date.now(),
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
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

  // Store verifier and state in temporary secure HTTP-only cookies
  response.cookies.set({
    name: AUTH_CONFIG.stateCookieName,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600, // 10 minutes
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

  return response;
}
