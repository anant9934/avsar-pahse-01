import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const metrics = db.getAdminMetrics();
  return NextResponse.json({ metrics });
}
