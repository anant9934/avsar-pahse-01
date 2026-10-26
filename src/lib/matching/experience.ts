import type { Job, Candidate } from "../../types/index.ts";

export function calculateExperienceMatch(candidate: Candidate, job: Job): number {
  const totalMonthsExp = candidate.experience.length * 12;

  if (job.minExperienceMonths && job.minExperienceMonths > 0) {
    if (totalMonthsExp >= job.minExperienceMonths) {
      return Math.min(100, 85 + Math.round((totalMonthsExp / job.minExperienceMonths) * 10));
    }
    return Math.max(30, Math.round((totalMonthsExp / job.minExperienceMonths) * 80));
  }

  // Entry-level or internship baseline
  return candidate.experience.length > 0 ? 92 : 75;
}
