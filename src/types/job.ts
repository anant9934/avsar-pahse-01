import type { SalaryDetails } from "./salary.ts";

export type WorkArrangement = "Hybrid" | "Remote" | "Onsite" | "Unspecified";
export type EmploymentType = "Internship" | "Full Time" | "Part Time" | "Contract" | "Apprenticeship";

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
  benefits?: string[];
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
