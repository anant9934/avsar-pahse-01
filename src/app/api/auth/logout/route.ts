import { NextRequest, NextResponse } from "next/server";
import { AUTH_CONFIG } from "@/lib/auth/aitathastu";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(AUTH_CONFIG.cookieName);
  return response;
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/welcome", request.url));
  response.cookies.delete(AUTH_CONFIG.cookieName);
  return response;
}
