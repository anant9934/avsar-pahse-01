import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateJobMatch } from "@/lib/matching";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = db.getJobById(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const candidate = db.getCandidate();
  const match = calculateJobMatch(candidate, job);
  const isSaved = db.isJobSaved(job.id);

  return NextResponse.json({
    job,
    match,
    isSaved,
  });
}
