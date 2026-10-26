import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Lightweight Liveness Probe (RFC 8615 / Kubernetes standard)
 * 
 * Verifies that the Vercel function runtime / Node.js event loop is actively responsive.
 * Does NOT execute deep database or external network queries to prevent probe cascading.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "live",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "X-Health-Check": "liveness",
      },
    }
  );
}
