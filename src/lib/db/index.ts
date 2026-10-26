import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  INITIAL_APPLICATIONS,
  INITIAL_CANDIDATE,
  INITIAL_JOBS,
  INITIAL_RESUMES,
  INITIAL_SAVED_JOB_IDS,
  INITIAL_ADMIN_METRICS,
} from "./seed-data.ts";
import { extractAllJobsFromDataset } from "../jobs/normalization.ts";
import type { Application, Candidate, Job, Resume, AdminMetrics } from "../../types/index.ts";

export interface DbSchema {
  candidate: Candidate; // Primary/default candidate (Rohan Sharma)
  candidates?: Candidate[]; // Multi-candidate registry
  jobs: Job[];
  resumes: Resume[];
  applications: Application[];
  savedJobIds: string[]; // Primary saved job IDs
  savedJobIdsByCandidate?: Record<string, string[]>; // Candidate-scoped saved jobs
  adminMetrics: AdminMetrics;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const BAK_FILE = path.join(DATA_DIR, "db.json.bak");
const ROOT_JOBS_FILE = path.join(process.cwd(), "jobs.json");

function loadRootDatasetJobs(): Job[] {
  try {
    if (fs.existsSync(ROOT_JOBS_FILE)) {
      const rawText = fs.readFileSync(ROOT_JOBS_FILE, "utf-8");
      const { jobs } = extractAllJobsFromDataset(rawText);
      return jobs;
    }
  } catch (err) {
    console.error("Failed to load root jobs.json dataset", err);
  }
  return [];
}

function getInitialData(): DbSchema {
  const seedJobs: Job[] = JSON.parse(JSON.stringify(INITIAL_JOBS));
  const realJobs = loadRootDatasetJobs();

  // Combine seed jobs + real jobs without duplicates
  const seenKeys = new Set(seedJobs.map((j) => `${j.company.toLowerCase()}:::${j.title.toLowerCase()}`));
  for (const rj of realJobs) {
    const key = `${rj.company.toLowerCase()}:::${rj.title.toLowerCase()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      seedJobs.push(rj);
    }
  }

  const initialMetrics: AdminMetrics = JSON.parse(JSON.stringify(INITIAL_ADMIN_METRICS));
  initialMetrics.totalJobs = seedJobs.length;

  const defaultCandidate: Candidate = JSON.parse(JSON.stringify(INITIAL_CANDIDATE));

  return {
    candidate: defaultCandidate,
    candidates: [defaultCandidate],
    jobs: seedJobs,
    resumes: JSON.parse(JSON.stringify(INITIAL_RESUMES)),
    applications: JSON.parse(JSON.stringify(INITIAL_APPLICATIONS)),
    savedJobIds: [...INITIAL_SAVED_JOB_IDS],
    savedJobIdsByCandidate: {
      [defaultCandidate.id]: [...INITIAL_SAVED_JOB_IDS],
    },
    adminMetrics: initialMetrics,
  };
}

let memoryCache: DbSchema | null = null;
let lastMtimeMs = 0;

function ensureDb(): DbSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const stat = fs.statSync(DB_FILE);
      if (memoryCache && stat.mtimeMs <= lastMtimeMs) {
        return memoryCache;
      }
      const content = fs.readFileSync(DB_FILE, "utf-8");
      memoryCache = JSON.parse(content) as DbSchema;
      lastMtimeMs = stat.mtimeMs;

      // Ensure multi-candidate data structures are present
      if (!memoryCache.candidates || !Array.isArray(memoryCache.candidates)) {
        memoryCache.candidates = [memoryCache.candidate];
      } else if (!memoryCache.candidates.some((c) => c.id === memoryCache!.candidate.id)) {
        memoryCache.candidates.unshift(memoryCache.candidate);
      }

      if (!memoryCache.savedJobIdsByCandidate) {
        memoryCache.savedJobIdsByCandidate = {
          [memoryCache.candidate.id]: [...(memoryCache.savedJobIds || [])],
        };
      }

      // Check if real jobs dataset is missing from existing database (e.g. older db file)
      const hasRealJobs = memoryCache.jobs.some((j) => Boolean(j.sourcePlatform));
      if (!hasRealJobs) {
        const realJobs = loadRootDatasetJobs();
        if (realJobs.length > 0) {
          const existingKeys = new Set(
            memoryCache.jobs.map((j) => `${j.company.toLowerCase()}:::${j.title.toLowerCase()}`)
          );
          let added = 0;
          for (const rj of realJobs) {
            const key = `${rj.company.toLowerCase()}:::${rj.title.toLowerCase()}`;
            if (!existingKeys.has(key)) {
              existingKeys.add(key);
              memoryCache.jobs.push(rj);
              added++;
            }
          }
          if (added > 0) {
            memoryCache.adminMetrics.totalJobs = memoryCache.jobs.length;
            saveDb(memoryCache);
          }
        }
      }

      return memoryCache;
    }
  } catch (err) {
    console.error("Failed to read database file, attempting backup recovery", err);
    try {
      if (fs.existsSync(BAK_FILE)) {
        const bakContent = fs.readFileSync(BAK_FILE, "utf-8");
        memoryCache = JSON.parse(bakContent) as DbSchema;
        if (!memoryCache.candidates) memoryCache.candidates = [memoryCache.candidate];
        if (!memoryCache.savedJobIdsByCandidate) {
          memoryCache.savedJobIdsByCandidate = { [memoryCache.candidate.id]: [...memoryCache.savedJobIds] };
        }
        console.log("Successfully restored database from backup file");
        return memoryCache;
      }
    } catch (bakErr) {
      console.error("Backup recovery also failed", bakErr);
    }
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
    const jsonString = JSON.stringify(data, null, 2);
    const tmpFile = path.join(DATA_DIR, `db.tmp.${process.pid}.${Date.now()}`);

    // 1. Write to temporary file
    fs.writeFileSync(tmpFile, jsonString, "utf-8");

    // 2. Backup existing db if valid
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, BAK_FILE);
      } catch {
        // best effort backup
      }
    }

    // 3. Atomic rename (POSIX atomic replacement)
    fs.renameSync(tmpFile, DB_FILE);
    try {
      lastMtimeMs = fs.statSync(DB_FILE).mtimeMs;
    } catch {
      // ignore
    }
    memoryCache = data;
  } catch (err) {
    console.error("Failed to persist database file atomically", err);
  }
}

// Data Access Layer
export const db = {
  // Candidate
  getCandidate(candidateId?: string): Candidate {
    const data = ensureDb();
    if (candidateId) {
      const found = data.candidates?.find((c) => c.id === candidateId);
      if (found) return found;
      if (candidateId === data.candidate.id) return data.candidate;
    }
    return data.candidate;
  },

  getCandidateByTathastuId(aiTathastuId: string): Candidate | undefined {
    const data = ensureDb();
    if (!aiTathastuId) return undefined;
    return (
      data.candidates?.find((c) => c.aiTathastuId === aiTathastuId) ||
      (data.candidate.aiTathastuId === aiTathastuId ? data.candidate : undefined)
    );
  },

  createCandidate(input: {
    aiTathastuId: string;
    name: string;
    email: string;
    avatar?: string;
  }): Candidate {
    const data = ensureDb();
    if (!data.candidates) data.candidates = [data.candidate];

    const newCandidate: Candidate = {
      id: `cand_${randomUUID()}`,
      aiTathastuId: input.aiTathastuId,
      name: input.name,
      email: input.email,
      phone: "+91 98765 00000",
      location: "Bengaluru, India",
      headline: "Aspiring Software Engineer",
      avatar: input.avatar || "/images/avatar-rohan.jpg",
      skills: ["React", "TypeScript", "JavaScript"],
      experience: [],
      education: [
        {
          id: `edu_${randomUUID()}`,
          institution: "Technological Institute",
          degree: "B.Tech",
          field: "Computer Science",
          startYear: "2021",
          endYear: "2025",
        },
      ],
      projects: [],
      preferences: {
        targetRole: "Software Engineer",
        preferredLocation: "Bengaluru",
        workArrangement: "Hybrid",
      },
      erisScore: 85,
      profileCompletionPercentage: 55,
    };

    newCandidate.profileCompletionPercentage = calculateProfileCompletion(newCandidate);
    data.candidates.push(newCandidate);

    if (!data.savedJobIdsByCandidate) data.savedJobIdsByCandidate = {};
    data.savedJobIdsByCandidate[newCandidate.id] = [];

    saveDb(data);
    return newCandidate;
  },

  updateCandidate(updates: Partial<Candidate>, candidateId?: string): Candidate {
    const data = ensureDb();
    const targetId = candidateId || data.candidate.id;

    if (!data.candidates) data.candidates = [data.candidate];

    const candidateIdx = data.candidates.findIndex((c) => c.id === targetId);
    let target = candidateIdx >= 0 ? data.candidates[candidateIdx] : data.candidate;

    target = {
      ...target,
      ...updates,
    };
    target.profileCompletionPercentage = calculateProfileCompletion(target);

    if (candidateIdx >= 0) {
      data.candidates[candidateIdx] = target;
    }

    if (target.id === data.candidate.id || !candidateId) {
      data.candidate = target;
    }

    saveDb(data);
    return target;
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
      id: `job_${randomUUID()}`,
      postedAt: "Just now",
    };
    data.jobs.unshift(newJob);
    data.adminMetrics.totalJobs = (data.adminMetrics.totalJobs ?? 0) + 1;
    saveDb(data);
    return newJob;
  },

  upsertJobsBatch(jobsToUpsert: Job[]): { created: number; updated: number } {
    const data = ensureDb();
    let created = 0;
    let updated = 0;

    for (const job of jobsToUpsert) {
      const existingIndex = data.jobs.findIndex(
        (j) =>
          j.id === job.id ||
          (j.company.toLowerCase().trim() === job.company.toLowerCase().trim() &&
            j.title.toLowerCase().trim() === job.title.toLowerCase().trim())
      );

      if (existingIndex >= 0) {
        data.jobs[existingIndex] = {
          ...job,
          id: data.jobs[existingIndex].id,
          isFeatured: data.jobs[existingIndex].isFeatured ?? job.isFeatured,
        };
        updated++;
      } else {
        data.jobs.push(job);
        created++;
      }
    }

    data.adminMetrics.totalJobs = data.jobs.length;
    saveDb(data);
    return { created, updated };
  },

  // Resumes
  getResumes(candidateId?: string): Resume[] {
    const data = ensureDb();
    if (candidateId) {
      return data.resumes.filter((r) => r.candidateId === candidateId);
    }
    return data.resumes;
  },

  getResumeById(id: string): Resume | undefined {
    const data = ensureDb();
    return data.resumes.find((r) => r.id === id);
  },

  addResume(resume: Omit<Resume, "id" | "uploadedAt">, candidateId?: string): Resume {
    const data = ensureDb();
    const effectiveCandidateId = candidateId || resume.candidateId || data.candidate.id;

    const newResume: Resume = {
      ...resume,
      candidateId: effectiveCandidateId,
      id: `res_${randomUUID()}`,
      uploadedAt: "Just now",
    };

    if (newResume.isPrimary) {
      data.resumes
        .filter((r) => r.candidateId === effectiveCandidateId)
        .forEach((r) => (r.isPrimary = false));
    }
    data.resumes.unshift(newResume);
    saveDb(data);
    return newResume;
  },

  setPrimaryResume(id: string, candidateId?: string): Resume | undefined {
    const data = ensureDb();
    const target = data.resumes.find((r) => r.id === id);
    if (target) {
      const effectiveCandidateId = candidateId || target.candidateId;
      data.resumes
        .filter((r) => r.candidateId === effectiveCandidateId)
        .forEach((r) => (r.isPrimary = r.id === id));
      saveDb(data);
    }
    return target;
  },

  // Saved Jobs
  getSavedJobIds(candidateId?: string): string[] {
    const data = ensureDb();
    const effectiveCandidateId = candidateId || data.candidate.id;
    if (!data.savedJobIdsByCandidate) {
      data.savedJobIdsByCandidate = { [data.candidate.id]: [...(data.savedJobIds || [])] };
    }
    if (!data.savedJobIdsByCandidate[effectiveCandidateId]) {
      data.savedJobIdsByCandidate[effectiveCandidateId] =
        effectiveCandidateId === data.candidate.id ? [...(data.savedJobIds || [])] : [];
    }
    return data.savedJobIdsByCandidate[effectiveCandidateId];
  },

  toggleSaveJob(jobId: string, candidateId?: string): { isSaved: boolean } {
    const data = ensureDb();
    const effectiveCandidateId = candidateId || data.candidate.id;
    if (!data.savedJobIdsByCandidate) {
      data.savedJobIdsByCandidate = { [data.candidate.id]: [...(data.savedJobIds || [])] };
    }
    if (!data.savedJobIdsByCandidate[effectiveCandidateId]) {
      data.savedJobIdsByCandidate[effectiveCandidateId] =
        effectiveCandidateId === data.candidate.id ? [...(data.savedJobIds || [])] : [];
    }

    const list = data.savedJobIdsByCandidate[effectiveCandidateId];
    const index = list.indexOf(jobId);
    let isSaved = false;
    if (index >= 0) {
      list.splice(index, 1);
      isSaved = false;
    } else {
      list.push(jobId);
      isSaved = true;
    }

    if (effectiveCandidateId === data.candidate.id) {
      data.savedJobIds = [...list];
    }

    saveDb(data);
    return { isSaved };
  },

  isJobSaved(jobId: string, candidateId?: string): boolean {
    const list = this.getSavedJobIds(candidateId);
    return list.includes(jobId);
  },

  // Applications
  getApplications(candidateId?: string): Application[] {
    const data = ensureDb();
    const effectiveCandidateId = candidateId || data.candidate.id;
    const cand = this.getCandidate(effectiveCandidateId);
    const candidateApps = data.applications.filter((a) => a.candidateId === effectiveCandidateId);

    return candidateApps.map((app) => ({
      ...app,
      job: data.jobs.find((j) => j.id === app.jobId),
      candidate: cand,
    }));
  },

  getAllApplications(): Application[] {
    const data = ensureDb();
    return data.applications.map((app) => ({
      ...app,
      job: data.jobs.find((j) => j.id === app.jobId),
      candidate: this.getCandidate(app.candidateId),
    }));
  },

  getApplicationByRef(ref: string, candidateId?: string): Application | undefined {
    const apps = this.getApplications(candidateId);
    return apps.find((a) => a.referenceNumber === ref || a.id === ref);
  },

  submitApplication(submission: {
    jobId: string;
    resumeId: string;
    answers: Record<string, string>;
    candidateId?: string;
  }): { success: boolean; application?: Application; error?: string } {
    const data = ensureDb();
    const effectiveCandidateId = submission.candidateId || data.candidate.id;
    const cand = this.getCandidate(effectiveCandidateId);

    const job = data.jobs.find((j) => j.id === submission.jobId);
    if (!job) {
      return { success: false, error: "Job listing not found." };
    }

    // Check if listing is closed or expired
    if (job.isPossiblyClosed) {
      return {
        success: false,
        error:
          "This job listing is marked as closed or expired on the source platform and is no longer accepting new applications.",
      };
    }

    // Check duplicate application
    const existing = data.applications.find(
      (a) => a.jobId === submission.jobId && a.candidateId === effectiveCandidateId
    );
    if (existing) {
      return {
        success: false,
        error: `You have already submitted an application for this role (${existing.referenceNumber}).`,
        application: { ...existing, job, candidate: cand },
      };
    }

    const candidateResumes = data.resumes.filter((r) => r.candidateId === effectiveCandidateId);
    const resume =
      candidateResumes.find((r) => r.id === submission.resumeId) ||
      data.resumes.find((r) => r.id === submission.resumeId) ||
      candidateResumes[0] ||
      data.resumes[0];

    // Generate unique reference: AVS-YYYY-MMDD-XXXX
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(1000 + Math.random() * 9000);
    const referenceNumber = `AVS-${year}-${month}${day}-${rand}`;

    const newApp: Application = {
      id: `app_${randomUUID()}`,
      referenceNumber,
      jobId: submission.jobId,
      candidateId: effectiveCandidateId,
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
      id: `rec_${randomUUID()}`,
      candidateName: cand.name,
      candidateEmail: cand.email,
      candidateAvatar: cand.avatar,
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
        candidate: cand,
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
