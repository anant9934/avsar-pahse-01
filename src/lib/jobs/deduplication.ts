import type { Job } from "../../types/index.ts";

export function createJobBatchKey(company: string, title: string): string {
  return `${company.trim().toLowerCase()}:::${title.trim().toLowerCase()}`;
}

export function deduplicateJobsBatch(jobs: Job[]): {
  uniqueJobs: Job[];
  duplicateCount: number;
} {
  const seen = new Set<string>();
  const uniqueJobs: Job[] = [];
  let duplicateCount = 0;

  for (const job of jobs) {
    const key = createJobBatchKey(job.company, job.title);
    if (seen.has(key)) {
      duplicateCount++;
      continue;
    }
    seen.add(key);
    uniqueJobs.push(job);
  }

  return { uniqueJobs, duplicateCount };
}
