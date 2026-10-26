import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  checkAdminAuth,
  checkAdminRateLimit,
  getAdminSecret,
  logAdminAction,
} from "@/lib/auth/admin";
import { signSessionPayload } from "@/lib/auth/session";
import { timingSafeEqual } from "node:crypto";

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf-8");
    const bufB = Buffer.from(b, "utf-8");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const auth = checkAdminAuth(request);
  return NextResponse.json({ isAdmin: auth.authorized });
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    // Rate limiting check
    const rateLimit = checkAdminRateLimit(ip);
    if (!rateLimit.allowed) {
      logAdminAction({
        action: "admin_login_rate_limited",
        ip,
        success: false,
        details: "Exceeded max attempts in 5-minute window",
      });
      return NextResponse.json(
        {
          error: `Too many failed administrator login attempts. Please retry after ${rateLimit.retryAfterSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    const expectedSecret = getAdminSecret();
    if (!expectedSecret) {
      return NextResponse.json(
        {
          error:
            "Admin login is disabled in this environment. AVSAR_ADMIN_SECRET must be explicitly configured.",
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const candidateSecret = typeof body.secret === "string" ? body.secret.trim() : "";

    if (!candidateSecret || !safeCompare(candidateSecret, expectedSecret)) {
      logAdminAction({
        action: "admin_login_failed",
        ip,
        success: false,
        details: "Invalid admin key provided",
      });
      return NextResponse.json({ error: "Invalid administrator secret or key" }, { status: 401 });
    }

    // Generate cryptographically signed administrator session token
    const adminSessionToken = signSessionPayload({
      userId: "admin_system_operator",
      role: "admin",
      name: "System Administrator",
      email: "admin@avsar.local",
      avatar: "",
      provider: "admin_key",
      createdAt: Date.now(),
    });

    logAdminAction({
      action: "admin_login_success",
      ip,
      success: true,
      details: "Administrator session established",
    });

    const response = NextResponse.json({ success: true, message: "Administrator session authorized" });
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: adminSessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: "lax",
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  logAdminAction({
    action: "admin_logout",
    ip,
    success: true,
    details: "Admin session destroyed",
  });

  const response = NextResponse.json({ success: true, message: "Admin logged out" });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return response;
}
