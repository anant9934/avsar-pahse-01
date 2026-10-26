import type { WorkArrangement } from "./job.ts";

export interface WorkExperience {
  id: string;
  role: string;
  company: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  duration?: string;
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
  technologies?: string[];
  techStack?: string[];
  link?: string;
  githubUrl?: string;
  liveUrl?: string;
}

export interface CandidatePreferences {
  targetRole?: string;
  targetRoles?: string[];
  preferredLocation: string;
  workArrangement?: WorkArrangement;
  preferredArrangement?: "Hybrid" | "Remote" | "Onsite" | "Any";
  minExpectedSalary?: string;
  salaryExpectation?: string;
}

export interface Candidate {
  id: string;
  aiTathastuId?: string;
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  avatar: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  projects: Project[];
  preferences: CandidatePreferences;
  stats?: {
    viewsThisMonth: number;
    searchAppearances: number;
    matchScore: number;
  };
  erisScore: number;
  profileCompletionPercentage: number;
  bio?: string;
}
