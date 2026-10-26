import { isPostgresConfigured, DatabaseConfigurationError } from "../db/postgres.ts";
import {
  PostgresCandidateRepository,
  PostgresJobRepository,
  PostgresApplicationRepository,
  PostgresSavedJobRepository,
  PostgresResumeRepository,
  PostgresAuditRepository,
} from "./postgres.ts";
import type {
  CandidateRepository,
  JobRepository,
  ApplicationRepository,
  SavedJobRepository,
  ResumeRepository,
  AuditRepository,
  JobFilterOptions,
} from "./types.ts";
import { db } from "../db/index.ts";
import type { Application, Candidate, Job, Resume } from "../../types/index.ts";

// =============================================================================
// Local In-Memory / File Repository Adaptors (Dev / Testing Fallback)
// =============================================================================

export class LocalCandidateRepository implements CandidateRepository {
  async getById(id: string): Promise<Candidate | null> {
    const cand = db.getCandidate(id);
    return cand || null;
  }

  async getByTathastuId(tathastuId: string): Promise<Candidate | null> {
    const cand = db.getCandidateByTathastuId(tathastuId);
    return cand || null;
  }

  async create(data: {
    aiTathastuId: string;
    name: string;
    email: string;
    avatar?: string;
  }): Promise<Candidate> {
    return db.createCandidate(data);
  }

  async update(id: string, updates: Partial<Candidate>): Promise<Candidate> {
    return db.updateCandidate(updates, id);
  }

  async listAll(): Promise<Candidate[]> {
    const cand = db.getCandidate();
    return [cand];
  }
}

export class LocalJobRepository implements JobRepository {
  async list(filter?: JobFilterOptions): Promise<{ jobs: Job[]; total: number }> {
    let jobs = db.getJobs();

    if (filter?.q) {
      const q = filter.q.toLowerCase();
      jobs = jobs.filter((j) => {
        const matchTitle = j.title.toLowerCase().includes(q);
        const matchCompany = j.company.toLowerCase().includes(q);
        const matchCategory = (j.category || j.department || "").toLowerCase().includes(q);
        const matchLocation = j.location.toLowerCase().includes(q);
        return matchTitle || matchCompany || matchCategory || matchLocation;
      });
    }

    if (filter?.workArrangement && filter.workArrangement !== "all") {
      jobs = jobs.filter((j) => j.workArrangement.toLowerCase() === filter.workArrangement?.toLowerCase());
    }

    if (filter?.employmentType && filter.employmentType !== "all") {
      jobs = jobs.filter((j) => j.employmentType.toLowerCase().includes(filter.employmentType!.toLowerCase()));
    }

    if (filter?.category && filter.category !== "all") {
      jobs = jobs.filter((j) => (j.category || j.department || "").toLowerCase().includes(filter.category!.toLowerCase()));
    }

    if (filter?.verification && filter.verification !== "ALL") {
      jobs = jobs.filter((j) => (j.verificationStatus || "UNVERIFIED").toUpperCase() === filter.verification);
    }

    if (filter?.status === "open") {
      jobs = jobs.filter((j) => !j.isPossiblyClosed);
    }

    const total = jobs.length;
    if (filter?.limit && filter.limit > 0) {
      const page = filter.page && filter.page > 0 ? filter.page : 1;
      const offset = (page - 1) * filter.limit;
      jobs = jobs.slice(offset, offset + filter.limit);
    }

    return { jobs, total };
  }

  async getById(idOrSlug: string): Promise<Job | null> {
    return db.getJobById(idOrSlug) || null;
  }

  async create(job: Omit<Job, "id" | "postedAt">): Promise<Job> {
    return db.addJob(job);
  }

  async upsertBatch(jobs: Job[]): Promise<{ created: number; updated: number; unchanged: number }> {
    const res = db.upsertJobsBatch(jobs);
    return { created: res.created, updated: res.updated, unchanged: 0 };
  }

  async count(): Promise<number> {
    return db.getJobs().length;
  }
}

export class LocalApplicationRepository implements ApplicationRepository {
  async listByCandidate(candidateId: string): Promise<Application[]> {
    return db.getApplications(candidateId);
  }

  async listAll(): Promise<Application[]> {
    return db.getAllApplications();
  }

  async getByReference(ref: string, candidateId?: string): Promise<Application | null> {
    return db.getApplicationByRef(ref, candidateId) || null;
  }

  async submit(submission: {
    jobId: string;
    candidateId: string;
    resumeId: string;
    answers: Record<string, string>;
  }): Promise<{ success: boolean; application?: Application; error?: string }> {
    return db.submitApplication(submission);
  }

  async checkDuplicate(candidateId: string, jobId: string): Promise<Application | null> {
    const apps = db.getApplications(candidateId);
    return apps.find((a) => a.jobId === jobId) || null;
  }
}

export class LocalSavedJobRepository implements SavedJobRepository {
  async listByCandidate(candidateId: string): Promise<string[]> {
    return db.getSavedJobIds(candidateId);
  }

  async toggle(candidateId: string, jobId: string): Promise<{ isSaved: boolean }> {
    return db.toggleSaveJob(jobId, candidateId);
  }

  async isSaved(candidateId: string, jobId: string): Promise<boolean> {
    return db.isJobSaved(jobId, candidateId);
  }
}

export class LocalResumeRepository implements ResumeRepository {
  async listByCandidate(candidateId: string): Promise<Resume[]> {
    return db.getResumes(candidateId);
  }

  async getById(id: string): Promise<Resume | null> {
    return db.getResumeById(id) || null;
  }

  async create(
    resume: Omit<Resume, "id" | "uploadedAt">,
    candidateId: string
  ): Promise<Resume> {
    return db.addResume(resume, candidateId);
  }

  async setPrimary(id: string, candidateId: string): Promise<Resume | null> {
    return db.setPrimaryResume(id, candidateId) || null;
  }

  async delete(id: string, candidateId: string): Promise<boolean> {
    const resumes = db.getResumes(candidateId);
    const targetIdx = resumes.findIndex((r) => r.id === id);
    if (targetIdx >= 0) {
      resumes.splice(targetIdx, 1);
      return true;
    }
    return false;
  }
}

export class LocalAuditRepository implements AuditRepository {
  private inMemoryEvents: unknown[] = [];

  async logEvent(event: {
    actorType: "candidate" | "admin" | "system";
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void> {
    this.inMemoryEvents.unshift({
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  async listRecent(limit = 50): Promise<unknown[]> {
    return this.inMemoryEvents.slice(0, limit);
  }
}

// =============================================================================
// Repository Factory & Facade
// =============================================================================

function assertDatabaseConfiguredIfProduction() {
  if (process.env.NODE_ENV === "production" && !isPostgresConfigured()) {
    throw new DatabaseConfigurationError(
      "DATABASE_URL is not configured in production environment. Application refuses to start with ephemeral storage."
    );
  }
}

export function getCandidateRepository(): CandidateRepository {
  assertDatabaseConfiguredIfProduction();
  return isPostgresConfigured() ? new PostgresCandidateRepository() : new LocalCandidateRepository();
}

export function getJobRepository(): JobRepository {
  assertDatabaseConfiguredIfProduction();
  return isPostgresConfigured() ? new PostgresJobRepository() : new LocalJobRepository();
}

export function getApplicationRepository(): ApplicationRepository {
  assertDatabaseConfiguredIfProduction();
  return isPostgresConfigured() ? new PostgresApplicationRepository() : new LocalApplicationRepository();
}

export function getSavedJobRepository(): SavedJobRepository {
  assertDatabaseConfiguredIfProduction();
  return isPostgresConfigured() ? new PostgresSavedJobRepository() : new LocalSavedJobRepository();
}

export function getResumeRepository(): ResumeRepository {
  assertDatabaseConfiguredIfProduction();
  return isPostgresConfigured() ? new PostgresResumeRepository() : new LocalResumeRepository();
}

export function getAuditRepository(): AuditRepository {
  assertDatabaseConfiguredIfProduction();
  return isPostgresConfigured() ? new PostgresAuditRepository() : new LocalAuditRepository();
}

export * from "./types.ts";
