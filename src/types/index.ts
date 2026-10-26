export type WorkArrangement = "Hybrid" | "Remote" | "Onsite" | "Unspecified";
export type EmploymentType = "Internship" | "Full Time" | "Part Time" | "Contract" | "Apprenticeship";
export type ApplicationStatus = "Under Review" | "Shortlisted" | "Interview" | "Rejected" | "Offer";

export interface SalaryDetails {
  min?: number;
  max?: number;
  currency?: string;
  period?: "month" | "year" | "week" | string;
  rawClaim?: string;
}

export interface Job {
  id: string;
  slug: string;
  title: string;
  company: string;
  companyLogoKey: "google" | "tatadigital" | "flipkart" | "zoho" | "swiggy" | "default" | string;
  heroImage?: string;
  location: string;
  workArrangement: WorkArrangement;
  employmentType: EmploymentType;
  compensation: string; // e.g. "₹40,000/month" or "₹8-14 LPA"
  deadline: string; // e.g. "30 Apr 2025" or "Open"
  department: string;
  category?: string;
  overview: string;
  requirements: string[];
  responsibilities?: string[];
  benefits: string[];
  requiredSkills: string[];
  optionalSkills: string[];
  minExperienceMonths: number;
  educationRequirement: string;
  isFeatured?: boolean;
  postedAt: string;

  // Real jobs.json dataset fields
  sourceJobId?: string;
  sourcePlatform?: string;
  graduationYears?: number[];
  salaryDetails?: SalaryDetails;
  applyUrl?: string;
  applicationLinkType?:
    | "Direct Employer Link"
    | "Official career page"
    | "Referral form"
    | "Grouped referral post"
    | "Recruiter email"
    | "Official employer application plus mandatory questionnaire"
    | string;
  verificationStatus?:
    | "VERIFIED"
    | "PARTIALLY_VERIFIED"
    | "UNVERIFIED"
    | "DISCREPANCY"
    | "POSSIBLY_CLOSED"
    | string;
  verificationNote?: string;
  ppoClaim?: string | boolean;
  ctcClaim?: SalaryDetails;
  isPossiblyClosed?: boolean;
  isExternalApplication?: boolean;
  sourceMetadata?: Record<string, unknown>;
}

export interface WorkExperience {
  id: string;
  role: string;
  company: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
  gpa?: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  link?: string;
}

export interface Candidate {
  id: string;
  aiTathastuId?: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  avatar: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  projects: Project[];
  preferences: {
    targetRole: string;
    preferredLocation: string;
    workArrangement: WorkArrangement;
    minExpectedSalary?: string;
  };
  erisScore: number;
  profileCompletionPercentage: number;
  bio?: string;
}

export interface Resume {
  id: string;
  candidateId: string;
  fileName: string;
  fileSize: string; // e.g. "1.2 MB"
  uploadedAt: string; // relative or formatted date
  isPrimary: boolean;
  filePath?: string;
  storageKey?: string;
  storageProvider?: "local" | "s3" | string;
}

export interface Application {
  id: string;
  referenceNumber: string; // e.g. "AVS-2025-0412-8937"
  jobId: string;
  candidateId: string;
  resumeId: string;
  resumeName: string;
  status: ApplicationStatus;
  answers: {
    relevantExperience?: string;
    noticePeriod?: string;
    portfolioUrl?: string;
    customAnswers?: Record<string, string>;
  };
  appliedAt: string;
  appliedDateFormatted: string;
  updatedAt: string;
  job?: Job;
  candidate?: Candidate;
}

export interface MatchAnalysis {
  overallScore: number;
  ratingLabel: "Exceptional Match" | "Strong Match" | "Good Match" | "Moderate Match";
  eligibility: {
    isEligible: boolean;
    reason: string;
  };
  breakdown: {
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    locationMatch: number;
  };
  topMatchingSkills: string[];
  missingSkills: string[];
  highlights: string[];
}

export interface AdminMetrics {
  totalJobs: number;
  totalJobsGrowth: number;
  applicationsCount: number;
  applicationsGrowth: number;
  activeCandidates: number;
  activeCandidatesGrowth: number;
  employersCount: number;
  employersGrowth: number;
  monthlyOverview: Array<{
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
    companyLogoKey: string;
    status: ApplicationStatus;
    appliedOn: string;
  }>;
}
