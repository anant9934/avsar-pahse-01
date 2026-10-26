// ==============================================================================
// AVSAR CORE DOMAIN TYPE DEFINITIONS
// ==============================================================================

export * from "./salary.ts";
export * from "./candidate.ts";
export * from "./job.ts";
export * from "./match.ts";
export * from "./resume.ts";
export * from "./application.ts";

export interface AdminMetrics {
  totalCandidates: number;
  activeJobsCount: number;
  totalJobs?: number;
  applicationsCount: number;
  totalViews: number;
  placementRate: number;
  recentApplications: {
    id: string;
    candidateName: string;
    candidateEmail: string;
    candidateAvatar: string;
    jobTitle: string;
    company: string;
    companyLogoKey: string;
    status: string;
    appliedAt: string;
  }[];
}
