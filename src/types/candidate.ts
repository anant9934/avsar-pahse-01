export interface WorkExperience {
  id: string;
  role: string;
  company: string;
  duration: string;
  description: string;
}

export interface Education {
  id: string;
  degree: string;
  field: string;
  institution: string;
  startYear: string;
  endYear: string;
}

export interface Project {
  id: string;
  title: string;
  techStack: string[];
  description: string;
  githubUrl?: string;
  liveUrl?: string;
}

export interface CandidatePreferences {
  targetRoles: string[];
  preferredLocation: string;
  preferredArrangement: "Hybrid" | "Remote" | "Onsite" | "Any";
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
