import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const candidate = db.getCandidate();
  return NextResponse.json({ candidate });
}

export async function PATCH(request: NextRequest) {
  try {
    const updates = await request.json();
    const updated = db.updateCandidate(updates);
    return NextResponse.json({ success: true, candidate: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
