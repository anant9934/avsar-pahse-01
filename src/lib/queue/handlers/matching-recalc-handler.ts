import type { JobHandler } from "../types.ts";
import { getCandidateRepository, getJobRepository } from "@/lib/repository";
import { calculateJobMatch } from "@/lib/matching";
import { cachePurgeTag } from "@/lib/cache";

export interface MatchingRecalcJobPayload {
  candidateId: string;
  trigger: "profile_update" | "skills_update" | "resume_upload";
}

/**
 * Background worker handler that recalculates match scores and purges
 * candidate-specific recommendation caches asynchronously.
 */
export const matchingRecalcJobHandler: JobHandler<MatchingRecalcJobPayload> = async (job) => {
  const { candidateId, trigger } = job.payload;
  const candRepo = getCandidateRepository();
  const jobRepo = getJobRepository();

  const candidate = await candRepo.getById(candidateId);
  if (!candidate) {
    return;
  }

  // Purge any cached recommendation views for this candidate
  await cachePurgeTag(`candidate:${candidateId}`);

  // Warm top 10 recommended jobs in the background
  const { jobs } = await jobRepo.list({ status: "open" });
  const sample = jobs.slice(0, 10);

  // Compute matches asynchronously to warm memory
  for (const item of sample) {
    calculateJobMatch(candidate, item);
  }
};
