import { InvertedIndex, type SearchResult, type InvertedIndexOptions } from "./inverted-index.ts";
import type { Job } from "../../types/index.ts";

let globalSearchIndex: InvertedIndex | null = null;

export function getSearchIndex(options?: InvertedIndexOptions): InvertedIndex {
  if (!globalSearchIndex) {
    globalSearchIndex = new InvertedIndex(options);
  }
  return globalSearchIndex;
}

export function searchJobs(
  queryText: string,
  options?: { limit?: number; minScore?: number }
): SearchResult[] {
  return getSearchIndex().search(queryText, options);
}

export function indexJob(job: Job): void {
  getSearchIndex().indexJob(job);
}

export function indexJobs(jobs: Job[]): void {
  getSearchIndex().indexJobs(jobs);
}

export function removeJobFromIndex(jobId: string): void {
  getSearchIndex().removeJob(jobId);
}

export function resetSearchIndexForTesting(): void {
  if (globalSearchIndex) {
    globalSearchIndex.clear();
    globalSearchIndex = null;
  }
}

export * from "./tokenizer.ts";
export * from "./inverted-index.ts";
