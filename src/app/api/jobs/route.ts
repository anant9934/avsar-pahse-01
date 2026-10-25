import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateJobMatch } from "@/lib/matching";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.toLowerCase();
  const filter = searchParams.get("filter")?.toLowerCase(); // 'all', 'remote', 'bengaluru', 'internship', 'full-time', 'latest'
  const sort = searchParams.get("sort") || "recommended"; // 'recommended' | 'latest' | 'salary'

  let jobs = db.getJobs();
  const candidate = db.getCandidate();

  // Search filter
  if (q) {
    jobs = jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.requiredSkills.some((s) => s.toLowerCase().includes(q)) ||
        j.location.toLowerCase().includes(q)
    );
  }

  // Quick tag filter
  if (filter && filter !== "all" && filter !== "for you") {
    if (filter === "remote") {
      jobs = jobs.filter((j) => j.workArrangement === "Remote");
    } else if (filter === "bengaluru") {
      jobs = jobs.filter((j) => j.location.toLowerCase().includes("bengaluru"));
    } else if (filter === "internship") {
      jobs = jobs.filter((j) => j.employmentType === "Internship");
    } else if (filter === "full-time" || filter === "full time") {
      jobs = jobs.filter((j) => j.employmentType === "Full Time");
    }
  }

  // Calculate match scores for all jobs
  const jobsWithMatch = jobs.map((job) => {
    const match = calculateJobMatch(candidate, job);
    const isSaved = db.isJobSaved(job.id);
    return {
      ...job,
      matchScore: match.overallScore,
      matchLabel: match.ratingLabel,
      isSaved,
    };
  });

  // Sort
  if (sort === "recommended") {
    jobsWithMatch.sort((a, b) => b.matchScore - a.matchScore);
  } else if (sort === "latest") {
    // preserve order or by id
  }

  return NextResponse.json({
    total: jobsWithMatch.length,
    jobs: jobsWithMatch,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.title || !body.company) {
      return NextResponse.json({ error: "Title and Company are required" }, { status: 400 });
    }
    const created = db.addJob(body);
    return NextResponse.json({ success: true, job: created }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
