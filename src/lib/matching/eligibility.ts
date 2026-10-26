import type { Job, Candidate } from "../../types/index.ts";

export function evaluateEligibility(candidate: Candidate, job: Job): {
  isEligible: boolean;
  reason: string;
} {
  let isEligible = candidate.education.length > 0;
  let reason = isEligible
    ? "You meet the core degree and prerequisite requirements for this role."
    : "Degree verification pending.";

  if (job.graduationYears && job.graduationYears.length > 0) {
    const candGradYear = candidate.education.length > 0
      ? parseInt(candidate.education[0].endYear, 10)
      : NaN;

    if (!isNaN(candGradYear)) {
      if (job.graduationYears.includes(candGradYear)) {
        isEligible = true;
        reason = `Eligible: Your graduation batch (${candGradYear}) matches required batches: ${job.graduationYears.join(", ")}.`;
      } else {
        isEligible = false;
        reason = `Requires graduation batch: ${job.graduationYears.join(", ")} (Your batch: ${candGradYear}).`;
      }
    }
  }

  return { isEligible, reason };
}
