export type WorkArrangement = "Hybrid" | "Remote" | "Onsite";
export type EmploymentType = "Internship" | "Full Time" | "Part Time" | "Contract";
export type ApplicationStatus = "Under Review" | "Shortlisted" | "Interview" | "Rejected" | "Offer";

export interface Job {
  id: string;
  slug: string;
  title: string;
  company: string;
  companyLogoKey: "google" | "tatadigital" | "flipkart" | "zoho" | "swiggy";
  heroImage?: string;
  location: string;
  workArrangement: WorkArrangement;
  employmentType: EmploymentType;
  compensation: string; // e.g. "₹40,000/month" or "₹8-14 LPA"
  deadline: string; // e.g. "30 Apr 2025"
  department: string;
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
}

export interface Resume {
  id: string;
  candidateId: string;
  fileName: string;
  fileSize: string; // e.g. "1.2 MB"
  uploadedAt: string; // relative or formatted date
  isPrimary: boolean;
  filePath?: string;
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
