// ==============================================================================
// AVSAR CORE DOMAIN TYPE DEFINITIONS
// ==============================================================================

export * from "./salary.ts";
export * from "./candidate.ts";
export * from "./job.ts";
export * from "./match.ts";
export * from "./resume.ts";
export * from "./application.ts";

import type { ApplicationStatus } from "./application.ts";

export interface AdminMetrics {
  totalCandidates?: number;
  activeJobsCount?: number;
  totalJobs: number;
  totalJobsGrowth?: number;
  applicationsCount: number;
  applicationsGrowth?: number;
  activeCandidates?: number;
  activeCandidatesGrowth?: number;
  employersCount?: number;
  employersGrowth?: number;
  totalViews?: number;
  placementRate?: number;
  monthlyOverview?: Array<{
    month: string;
    applications: number;
  }>;
  recentApplications: Array<{
    id: string;
    candidateName: string;
    candidateEmail: string;
    candidateAvatar?: string;
    jobTitle: string;
    company: string;
    companyLogoKey?: string;
    status: ApplicationStatus | string;
    appliedAt?: string;
    appliedOn?: string;
  }>;
}
