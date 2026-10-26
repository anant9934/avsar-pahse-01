import type { Application, Candidate, Job, Resume } from "../../types/index.ts";

export interface JobFilterOptions {
  q?: string;
  workArrangement?: string;
  employmentType?: string;
  category?: string;
  batchYear?: number;
  verification?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface CandidateRepository {
  getById(id: string): Promise<Candidate | null>;
  getByTathastuId(tathastuId: string): Promise<Candidate | null>;
  create(data: {
    aiTathastuId: string;
    name: string;
    email: string;
    avatar?: string;
  }): Promise<Candidate>;
  update(id: string, updates: Partial<Candidate>): Promise<Candidate>;
  listAll(): Promise<Candidate[]>;
}

export interface JobRepository {
  list(filter?: JobFilterOptions): Promise<{ jobs: Job[]; total: number }>;
  getById(idOrSlug: string): Promise<Job | null>;
  create(job: Omit<Job, "id" | "postedAt">): Promise<Job>;
  upsertBatch(jobs: Job[]): Promise<{ created: number; updated: number; unchanged: number }>;
  count(): Promise<number>;
}

export interface ApplicationRepository {
  listByCandidate(candidateId: string): Promise<Application[]>;
  listAll(): Promise<Application[]>;
  getByReference(ref: string, candidateId?: string): Promise<Application | null>;
  submit(submission: {
    jobId: string;
    candidateId: string;
    resumeId: string;
    answers: Record<string, string>;
  }): Promise<{ success: boolean; application?: Application; error?: string }>;
  checkDuplicate(candidateId: string, jobId: string): Promise<Application | null>;
}

export interface SavedJobRepository {
  listByCandidate(candidateId: string): Promise<string[]>;
  toggle(candidateId: string, jobId: string): Promise<{ isSaved: boolean }>;
  isSaved(candidateId: string, jobId: string): Promise<boolean>;
}

export interface ResumeRepository {
  listByCandidate(candidateId: string): Promise<Resume[]>;
  getById(id: string): Promise<Resume | null>;
  create(
    resume: Omit<Resume, "id" | "uploadedAt">,
    candidateId: string
  ): Promise<Resume>;
  setPrimary(id: string, candidateId: string): Promise<Resume | null>;
  delete(id: string, candidateId: string): Promise<boolean>;
}

export interface AuditRepository {
  logEvent(event: {
    actorType: "candidate" | "admin" | "system";
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void>;
  listRecent(limit?: number): Promise<unknown[]>;
}
