import type { Job } from "../../types/index.ts";
import { tokenize } from "./tokenizer.ts";

export interface SearchResult {
  jobId: string;
  score: number;
}

export interface InvertedIndexOptions {
  titleWeight?: number;
  companyWeight?: number;
  skillWeight?: number;
  categoryWeight?: number;
  overviewWeight?: number;
}

export class InvertedIndex {
  // token -> Map<jobId, accumulatedWeight>
  private postings = new Map<string, Map<string, number>>();
  private jobMap = new Map<string, Job>();

  private readonly titleWeight: number;
  private readonly companyWeight: number;
  private readonly skillWeight: number;
  private readonly categoryWeight: number;
  private readonly overviewWeight: number;

  constructor(options: InvertedIndexOptions = {}) {
    this.titleWeight = options.titleWeight ?? 3.0;
    this.companyWeight = options.companyWeight ?? 2.0;
    this.skillWeight = options.skillWeight ?? 2.5;
    this.categoryWeight = options.categoryWeight ?? 1.5;
    this.overviewWeight = options.overviewWeight ?? 1.0;
  }

  /**
   * Adds or updates a job in the index.
   */
  indexJob(job: Job): void {
    this.removeJob(job.id);
    this.jobMap.set(job.id, job);

    const recordTokens = (tokens: string[], weight: number) => {
      for (const token of tokens) {
        let docMap = this.postings.get(token);
        if (!docMap) {
          docMap = new Map<string, number>();
          this.postings.set(token, docMap);
        }
        const current = docMap.get(job.id) || 0;
        docMap.set(job.id, current + weight);
      }
    };

    recordTokens(tokenize(job.title), this.titleWeight);
    recordTokens(tokenize(job.company), this.companyWeight);
    if (job.category) recordTokens(tokenize(job.category), this.categoryWeight);
    if (job.department) recordTokens(tokenize(job.department), this.categoryWeight);
    if (job.location) recordTokens(tokenize(job.location), 1.0);

    if (Array.isArray(job.requiredSkills)) {
      for (const skill of job.requiredSkills) {
        recordTokens(tokenize(skill), this.skillWeight);
      }
    }

    if (job.overview) {
      recordTokens(tokenize(job.overview), this.overviewWeight);
    }
  }

  /**
   * Bulk indexes a list of jobs.
   */
  indexJobs(jobs: Job[]): void {
    for (const job of jobs) {
      this.indexJob(job);
    }
  }

  /**
   * Removes a job from all posting lists.
   */
  removeJob(jobId: string): void {
    if (!this.jobMap.has(jobId)) return;
    this.jobMap.delete(jobId);

    for (const docMap of this.postings.values()) {
      docMap.delete(jobId);
    }
  }

  /**
   * Searches the index and returns ranked job IDs with relevance scores.
   */
  search(queryText: string, options?: { limit?: number; minScore?: number }): SearchResult[] {
    const queryTokens = tokenize(queryText);
    if (queryTokens.length === 0) {
      return [];
    }

    const docScores = new Map<string, number>();
    const docTokenMatches = new Map<string, number>();

    for (const token of queryTokens) {
      const docMap = this.postings.get(token);
      if (!docMap) continue;

      for (const [jobId, weight] of docMap.entries()) {
        const currentScore = docScores.get(jobId) || 0;
        docScores.set(jobId, currentScore + weight);

        const currentMatches = docTokenMatches.get(jobId) || 0;
        docTokenMatches.set(jobId, currentMatches + 1);
      }
    }

    const results: SearchResult[] = [];
    const minScore = options?.minScore ?? 0.5;

    for (const [jobId, score] of docScores.entries()) {
      // Co-occurrence bonus: multiply score if all query tokens matched
      const matches = docTokenMatches.get(jobId) || 1;
      const matchRatio = matches / queryTokens.length;
      const finalScore = score * (1 + matchRatio);

      if (finalScore >= minScore) {
        results.push({ jobId, score: Number(finalScore.toFixed(2)) });
      }
    }

    // Sort descending by relevance score
    results.sort((a, b) => b.score - a.score);

    if (options?.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  getJob(jobId: string): Job | undefined {
    return this.jobMap.get(jobId);
  }

  size(): number {
    return this.jobMap.size;
  }

  clear(): void {
    this.postings.clear();
    this.jobMap.clear();
  }
}
