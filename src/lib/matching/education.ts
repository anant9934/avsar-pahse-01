import type { Candidate } from "../../types/index.ts";

function norm(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

export function calculateEducationMatch(candidate: Candidate): number {
  if (candidate.education.length === 0) {
    return 40;
  }

  const hasTechnicalDegree = candidate.education.some((ed) => {
    const f = norm(ed.field || "");
    const d = norm(ed.degree || "");
    return (
      f.includes("computer") ||
      f.includes("information") ||
      f.includes("software") ||
      f.includes("technology") ||
      f.includes("engineering") ||
      d.includes("btech") ||
      d.includes("be") ||
      d.includes("bca") ||
      d.includes("mca")
    );
  });

  return hasTechnicalDegree ? 88 : 70;
}
