import type { Job } from "./job.ts";
import type { Candidate } from "./candidate.ts";

export type ApplicationStatus = "Under Review" | "Shortlisted" | "Interview" | "Rejected" | "Offer";

export interface Application {
  id: string;
  referenceNumber: string; // e.g. "AVS-2025-0412-8937"
  jobId: string;
  candidateId: string;
  resumeId: string;
  resumeName: string;
  status: ApplicationStatus;
  appliedAt: string; // ISO string
  appliedDateFormatted: string; // e.g. "12 Apr 2025"
  updatedAt: string;
  answers: Record<string, string>;
  timeline?: {
    stage: string;
    completed: boolean;
    date?: string;
  }[];
  // Hydrated references
  job?: Job;
  candidate?: Candidate;
}
