import type { Job, Candidate } from "../../types/index.ts";

export function generateMatchHighlights(
  candidate: Candidate,
  job: Job,
  topMatchingSkills: string[],
  missingSkills: string[]
): string[] {
  const highlights: string[] = [];

  if (topMatchingSkills.length >= 2) {
    highlights.push(`Strong ${topMatchingSkills.slice(0, 2).join(" & ")} skills`);
  } else if (topMatchingSkills.length === 1) {
    highlights.push(`Verified skills in ${topMatchingSkills[0]}`);
  }

  if (candidate.experience.length > 0) {
    highlights.push(`${candidate.experience[0].role} background`);
  } else if (candidate.projects.length > 0) {
    highlights.push("Hands-on project experience");
  }

  if (missingSkills.length > 0) {
    highlights.push(`Learn ${missingSkills[0]} to strengthen fit`);
  }

  if (job.isPossiblyClosed) {
    highlights.unshift("Listing may be closed or expired on source platform");
  }

  return highlights;
}
