import type { Job, Candidate } from "../../types/index.ts";

function norm(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

export function calculateLocationMatch(candidate: Candidate, job: Job): number {
  if (job.workArrangement === "Remote") {
    return 100;
  }

  const candidateLoc = norm(candidate.location || "");
  const jobLoc = norm(job.location || "");

  if (jobLoc && candidateLoc && (candidateLoc.includes(jobLoc) || jobLoc.includes(candidateLoc))) {
    return 90;
  }

  if (candidateLoc.includes("bengaluru") && jobLoc.includes("bengaluru")) {
    return 90;
  }

  if (candidate.preferences?.preferredLocation && norm(candidate.preferences.preferredLocation).includes(jobLoc)) {
    return 80;
  }

  return 65;
}
