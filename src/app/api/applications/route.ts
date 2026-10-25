import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const applications = db.getApplications();
  return NextResponse.json({
    total: applications.length,
    applications,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, resumeId, answers } = body;

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const result = db.submitApplication({
      jobId,
      resumeId: resumeId || "res_1",
      answers: answers || {},
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, application: result.application },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      application: result.application,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
