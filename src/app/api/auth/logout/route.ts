import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/aitathastu";
import { ADMIN_COOKIE_NAME } from "@/lib/auth/admin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

function clearAllAuthCookies(response: NextResponse) {
  const cookiesToClear = [
    SESSION_COOKIE_NAME,
    ADMIN_COOKIE_NAME,
    AUTH_CONFIG.stateCookieName,
    AUTH_CONFIG.verifierCookieName,
    AUTH_CONFIG.returnToCookieName,
  ];

  for (const cookie of cookiesToClear) {
    response.cookies.set({
      name: cookie,
      value: "",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }
}

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message:
      "Avsar session successfully invalidated and cleared. Note: Logging out of Avsar terminates local application access and does not revoke upstream AI Tathastu single-sign-on sessions.",
  });
  clearAllAuthCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/welcome", request.url));
  clearAllAuthCookies(response);
  return response;
}
