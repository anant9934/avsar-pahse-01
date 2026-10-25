import fs from "node:fs";
import path from "node:path";
import {
  INITIAL_APPLICATIONS,
  INITIAL_CANDIDATE,
  INITIAL_JOBS,
  INITIAL_RESUMES,
  INITIAL_SAVED_JOB_IDS,
  INITIAL_ADMIN_METRICS,
} from "./seed-data";
import type { Application, Candidate, Job, Resume, AdminMetrics } from "@/types";

interface DbSchema {
  candidate: Candidate;
  jobs: Job[];
  resumes: Resume[];
  applications: Application[];
  savedJobIds: string[];
  adminMetrics: AdminMetrics;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function getInitialData(): DbSchema {
  return {
    candidate: JSON.parse(JSON.stringify(INITIAL_CANDIDATE)),
    jobs: JSON.parse(JSON.stringify(INITIAL_JOBS)),
    resumes: JSON.parse(JSON.stringify(INITIAL_RESUMES)),
    applications: JSON.parse(JSON.stringify(INITIAL_APPLICATIONS)),
    savedJobIds: [...INITIAL_SAVED_JOB_IDS],
    adminMetrics: JSON.parse(JSON.stringify(INITIAL_ADMIN_METRICS)),
  };
}

let memoryCache: DbSchema | null = null;

function ensureDb(): DbSchema {
  if (memoryCache) return memoryCache;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      memoryCache = JSON.parse(content) as DbSchema;
      return memoryCache;
    }
  } catch (err) {
    console.error("Failed to read database file, initializing defaults", err);
  }

  const initial = getInitialData();
  saveDb(initial);
  memoryCache = initial;
  return memoryCache;
}

function saveDb(data: DbSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    memoryCache = data;
  } catch (err) {
    console.error("Failed to persist database file", err);
  }
}

// Data Access Layer
export const db = {
  // Candidate
  getCandidate(): Candidate {
    const data = ensureDb();
    return data.candidate;
  },

  updateCandidate(updates: Partial<Candidate>): Candidate {
    const data = ensureDb();
    data.candidate = {
      ...data.candidate,
      ...updates,
    };
    // Recalculate profile completion percentage dynamically
    data.candidate.profileCompletionPercentage = calculateProfileCompletion(data.candidate);
    saveDb(data);
    return data.candidate;
  },

  // Jobs
  getJobs(): Job[] {
    const data = ensureDb();
    return data.jobs;
  },

  getJobById(idOrSlug: string): Job | undefined {
    const data = ensureDb();
    return data.jobs.find((j) => j.id === idOrSlug || j.slug === idOrSlug);
  },

  addJob(job: Omit<Job, "id" | "postedAt">): Job {
    const data = ensureDb();
    const newJob: Job = {
      ...job,
      id: `job_${Date.now()}`,
      postedAt: "Just now",
    };
    data.jobs.unshift(newJob);
    data.adminMetrics.totalJobs += 1;
    saveDb(data);
    return newJob;
  },

  // Resumes
  getResumes(): Resume[] {
    const data = ensureDb();
    return data.resumes;
  },

  addResume(resume: Omit<Resume, "id" | "uploadedAt">): Resume {
    const data = ensureDb();
    const newResume: Resume = {
      ...resume,
      id: `res_${Date.now()}`,
      uploadedAt: "Just now",
    };
    if (newResume.isPrimary) {
      data.resumes.forEach((r) => (r.isPrimary = false));
    }
    data.resumes.unshift(newResume);
    saveDb(data);
    return newResume;
  },

  setPrimaryResume(id: string): Resume | undefined {
    const data = ensureDb();
    const target = data.resumes.find((r) => r.id === id);
    if (target) {
      data.resumes.forEach((r) => (r.isPrimary = r.id === id));
      saveDb(data);
    }
    return target;
  },

  // Saved Jobs
  getSavedJobIds(): string[] {
    const data = ensureDb();
    return data.savedJobIds;
  },

  toggleSaveJob(jobId: string): { isSaved: boolean } {
    const data = ensureDb();
    const index = data.savedJobIds.indexOf(jobId);
    let isSaved = false;
    if (index >= 0) {
      data.savedJobIds.splice(index, 1);
      isSaved = false;
    } else {
      data.savedJobIds.push(jobId);
      isSaved = true;
    }
    saveDb(data);
    return { isSaved };
  },

  isJobSaved(jobId: string): boolean {
    const data = ensureDb();
    return data.savedJobIds.includes(jobId);
  },

  // Applications
  getApplications(): Application[] {
    const data = ensureDb();
    // Hydrate job
    return data.applications.map((app) => ({
      ...app,
      job: data.jobs.find((j) => j.id === app.jobId),
      candidate: data.candidate,
    }));
  },

  getApplicationByRef(ref: string): Application | undefined {
    const apps = this.getApplications();
    return apps.find((a) => a.referenceNumber === ref || a.id === ref);
  },

  submitApplication(submission: {
    jobId: string;
    resumeId: string;
    answers: Record<string, string>;
  }): { success: boolean; application?: Application; error?: string } {
    const data = ensureDb();
    const job = data.jobs.find((j) => j.id === submission.jobId);
    if (!job) {
      return { success: false, error: "Job listing not found." };
    }

    // Check duplicate application
    const existing = data.applications.find(
      (a) => a.jobId === submission.jobId && a.candidateId === data.candidate.id
    );
    if (existing) {
      return {
        success: false,
        error: `You have already submitted an application for this role (${existing.referenceNumber}).`,
        application: { ...existing, job, candidate: data.candidate },
      };
    }

    const resume = data.resumes.find((r) => r.id === submission.resumeId) || data.resumes[0];

    // Generate unique reference: AVS-YYYY-MMDD-XXXX
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(1000 + Math.random() * 9000);
    const referenceNumber = `AVS-${year}-${month}${day}-${rand}`;

    const newApp: Application = {
      id: `app_${Date.now()}`,
      referenceNumber,
      jobId: submission.jobId,
      candidateId: data.candidate.id,
      resumeId: resume?.id || "res_1",
      resumeName: resume?.fileName || "Resume.pdf",
      status: "Under Review",
      answers: submission.answers,
      appliedAt: now.toISOString(),
      appliedDateFormatted: "Applied today",
      updatedAt: now.toISOString(),
    };

    data.applications.unshift(newApp);
    data.adminMetrics.applicationsCount += 1;

    // Add to admin recent applications
    data.adminMetrics.recentApplications.unshift({
      id: `rec_${Date.now()}`,
      candidateName: data.candidate.name,
      candidateEmail: data.candidate.email,
      candidateAvatar: data.candidate.avatar,
      jobTitle: job.title,
      company: job.company,
      companyLogoKey: job.companyLogoKey,
      status: "Under Review",
      appliedOn: "Today",
    });

    saveDb(data);

    return {
      success: true,
      application: {
        ...newApp,
        job,
        candidate: data.candidate,
      },
    };
  },

  // Admin Metrics
  getAdminMetrics(): AdminMetrics {
    const data = ensureDb();
    return data.adminMetrics;
  },
};

/**
 * Deterministic profile completion formula:
 * - Avatar: 10%
 * - Basic info (Name, Email, Phone, Location, Headline): 20%
 * - Skills (>= 5): 20%
 * - Education (>= 1): 20%
 * - Experience (>= 1): 15%
 * - Projects (>= 1): 15%
 */
export function calculateProfileCompletion(c: Candidate): number {
  let score = 0;
  if (c.avatar) score += 10;
  if (c.name && c.email && c.phone && c.location && c.headline) score += 20;
  if (c.skills && c.skills.length >= 5) score += 20;
  else if (c.skills && c.skills.length > 0) score += 10;
  if (c.education && c.education.length > 0) score += 20;
  if (c.experience && c.experience.length > 0) score += 15;
  if (c.projects && c.projects.length > 0) score += 15;
  return Math.min(100, score);
}
