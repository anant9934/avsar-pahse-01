import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const savedJobIds = db.getSavedJobIds();
  const allJobs = db.getJobs();
  const savedJobs = allJobs.filter((j) => savedJobIds.includes(j.id));
  return NextResponse.json({
    savedJobIds,
    savedJobs,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const jobId = body.jobId;
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }
    const result = db.toggleSaveJob(jobId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
