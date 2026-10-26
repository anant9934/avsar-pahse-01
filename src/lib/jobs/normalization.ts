import type { Job, SalaryDetails, WorkArrangement, EmploymentType } from "@/types";

/**
 * Robust JSON block parser capable of handling multiple concatenated JSON blocks
 * (such as root-level array followed by metadata object in jobs.json)
 */
export function parseMultiJsonBlocks(text: string): unknown[] {
  const blocks: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0 && start !== -1) {
        const snippet = text.slice(start, i + 1).trim();
        try {
          blocks.push(JSON.parse(snippet));
        } catch (err) {
          console.error("Failed to parse JSON block at position", start, err);
        }
        start = -1;
      }
    }
  }

  return blocks;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalizes company logo key to known Avsar icon assets
 */
export function normalizeCompanyLogoKey(company: string): string {
  const c = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (c.includes("google")) return "google";
  if (c.includes("tatadigital") || c.includes("tata")) return "tatadigital";
  if (c.includes("flipkart")) return "flipkart";
  if (c.includes("zoho")) return "zoho";
  if (c.includes("swiggy")) return "swiggy";
  if (c.includes("barclays")) return "barclays";
  if (c.includes("siemens")) return "siemens";
  if (c.includes("amazon")) return "amazon";
  if (c.includes("deloitte")) return "deloitte";
  if (c.includes("pwc")) return "pwc";
  if (c.includes("walmart")) return "walmart";
  if (c.includes("accenture")) return "accenture";
  if (c.includes("cognizant")) return "cognizant";
  return "default";
}

/**
 * Formats salary details and textual compensation display cleanly
 */
export function formatCompensation(
  salary: unknown,
  stipend: unknown,
  ctcClaim: unknown,
  salaryClaim: unknown,
  defaultCurrency = "INR"
): { compensation: string; salaryDetails?: SalaryDetails; ctcClaim?: SalaryDetails } {
  let primaryDetails: SalaryDetails | undefined;
  let formattedCtc: SalaryDetails | undefined;

  // 1. Structured stipend (e.g. from Block 2)
  if (stipend && typeof stipend === "object") {
    const s = stipend as { min?: number; max?: number; currency?: string; period?: string };
    const curSymbol = s.currency === "INR" || !s.currency ? "₹" : `${s.currency} `;
    const periodStr = s.period ? `/${s.period}` : "/month";
    primaryDetails = {
      min: s.min,
      max: s.max,
      currency: s.currency || defaultCurrency,
      period: s.period || "month",
    };
    if (s.min && s.max && s.min === s.max) {
      return {
        compensation: `${curSymbol}${s.min.toLocaleString("en-IN")}${periodStr}`,
        salaryDetails: primaryDetails,
      };
    } else if (s.min && s.max) {
      return {
        compensation: `${curSymbol}${s.min.toLocaleString("en-IN")} - ${curSymbol}${s.max.toLocaleString("en-IN")}${periodStr}`,
        salaryDetails: primaryDetails,
      };
    }
  }

  // 2. Structured CTC claim (e.g. year period)
  if (ctcClaim && typeof ctcClaim === "object") {
    const c = ctcClaim as { min?: number; max?: number; currency?: string; period?: string };
    formattedCtc = {
      min: c.min,
      max: c.max,
      currency: c.currency || defaultCurrency,
      period: c.period || "year",
    };
    const minLPA = c.min ? c.min / 100000 : undefined;
    const maxLPA = c.max ? c.max / 100000 : undefined;
    let label = "Competitive CTC";
    if (minLPA && maxLPA && minLPA === maxLPA) {
      label = `₹${minLPA} LPA`;
    } else if (minLPA && maxLPA) {
      label = `₹${minLPA} - ₹${maxLPA} LPA`;
    } else if (minLPA) {
      label = `₹${minLPA}+ LPA`;
    }
    return {
      compensation: label,
      salaryDetails: formattedCtc,
      ctcClaim: formattedCtc,
    };
  }

  // 3. Structured salary claim (e.g. monthly range claim)
  if (salaryClaim && typeof salaryClaim === "object") {
    const sc = salaryClaim as { min?: number; max?: number; currency?: string; period?: string };
    const curSymbol = sc.currency === "INR" || !sc.currency ? "₹" : `${sc.currency} `;
    const periodStr = sc.period ? `/${sc.period}` : "/month";
    primaryDetails = {
      min: sc.min,
      max: sc.max,
      currency: sc.currency || defaultCurrency,
      period: sc.period || "month",
      rawClaim: "Source unverified salary range",
    };
    if (sc.min && sc.max && sc.min === sc.max) {
      return {
        compensation: `${curSymbol}${sc.min.toLocaleString("en-IN")}${periodStr}`,
        salaryDetails: primaryDetails,
      };
    } else if (sc.min && sc.max) {
      return {
        compensation: `${curSymbol}${sc.min.toLocaleString("en-IN")} - ${curSymbol}${sc.max.toLocaleString("en-IN")}${periodStr}`,
        salaryDetails: primaryDetails,
      };
    }
  }

  // 4. Raw string claim from source (e.g. Barclays "12 LPA supplied by user", PwC "₹30,000 per month...")
  if (typeof salary === "string" && salary.trim()) {
    return {
      compensation: salary.trim(),
      salaryDetails: { rawClaim: salary.trim() },
    };
  }

  // 5. Default when no salary or null
  return {
    compensation: "Competitive / Disclosed on Application",
  };
}

/**
 * Formats deadline date string into human-friendly format (e.g. "2026-10-30" -> "30 Oct 2026")
 */
export function formatDeadline(rawDeadline?: string | null): string {
  if (!rawDeadline) return "Rolling / Open";
  try {
    const date = new Date(rawDeadline);
    if (!isNaN(date.getTime())) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }
  } catch {
    // fallback
  }
  return rawDeadline;
}

/**
 * Normalizes a single raw record from jobs.json into Avsar's Job model
 */
export function normalizeJobRecord(
  raw: Record<string, unknown>,
  blockIndex: number,
  blockMetadata?: { source?: string; checked_on?: string; notice?: string }
): { job?: Job; error?: string } {
  const company = typeof raw.company === "string" ? raw.company.trim() : "";
  const role = typeof raw.role === "string" ? raw.role.trim() : typeof raw.title === "string" ? raw.title.trim() : "";

  if (!company || !role) {
    return { error: `Missing required company ("${company}") or role ("${role}").` };
  }

  // Generate stable deterministic ID
  const rawJobId = typeof raw.job_id === "string" && raw.job_id.trim() ? raw.job_id.trim() : undefined;
  const companySlug = slugify(company);
  const roleSlug = slugify(role);
  const stableId = rawJobId
    ? `job_${companySlug}_${slugify(rawJobId)}`
    : `job_${companySlug}_${roleSlug}`;

  const slug = rawJobId
    ? `${roleSlug}-${companySlug}-${slugify(rawJobId)}`
    : `${roleSlug}-${companySlug}`;

  // Work arrangement
  let workArrangement: WorkArrangement = "Hybrid";
  const rawWorkModel = String(raw.work_model || raw.workArrangement || "").toLowerCase();
  if (rawWorkModel.includes("remote")) {
    workArrangement = "Remote";
  } else if (rawWorkModel.includes("onsite") || rawWorkModel.includes("site") || rawWorkModel.includes("office")) {
    workArrangement = "Onsite";
  } else if (rawWorkModel.includes("hybrid")) {
    workArrangement = "Hybrid";
  } else if (rawWorkModel.length === 0) {
    workArrangement = "Unspecified";
  }

  // Employment type
  let employmentType: EmploymentType = "Full Time";
  const rawEmpType = String(raw.employment_type || raw.employmentType || "").toLowerCase();
  const lowerRole = role.toLowerCase();
  if (rawEmpType.includes("intern") || lowerRole.includes("intern") || raw.duration_months || raw.stipend) {
    employmentType = "Internship";
  } else if (rawEmpType.includes("apprentice") || lowerRole.includes("apprentice")) {
    employmentType = "Apprenticeship";
  } else if (rawEmpType.includes("contract") || lowerRole.includes("contract")) {
    employmentType = "Contract";
  } else if (rawEmpType.includes("part") || lowerRole.includes("part-time")) {
    employmentType = "Part Time";
  }

  // Location
  let location = "India";
  if (Array.isArray(raw.location) && raw.location.length > 0) {
    location = raw.location.filter(Boolean).join(", ");
  } else if (typeof raw.location === "string" && raw.location.trim()) {
    location = raw.location.trim();
  }

  // Compensation
  const compResult = formatCompensation(
    raw.salary || raw.salary_claim_from_source || raw.stipend_claim_from_source,
    raw.stipend,
    raw.ctc_claim,
    raw.salary_claim,
    typeof raw.currency === "string" ? raw.currency : "INR"
  );

  // Application link & type
  let applyUrl: string | undefined = undefined;
  if (typeof raw.apply_url === "string" && raw.apply_url.trim()) {
    applyUrl = raw.apply_url.trim();
  } else if (typeof raw.application_url === "string" && raw.application_url.trim()) {
    applyUrl = raw.application_url.trim();
  } else if (typeof raw.recruiter_email === "string" && raw.recruiter_email.trim()) {
    applyUrl = `mailto:${raw.recruiter_email.trim()}`;
  }

  const isExternalApplication = Boolean(applyUrl && !applyUrl.includes("avsar.app"));

  // Application link type
  let applicationLinkType = "Direct Employer Link";
  if (typeof raw.application_link_type === "string" && raw.application_link_type.trim()) {
    applicationLinkType = raw.application_link_type.trim();
  } else if (blockIndex === 0) {
    applicationLinkType = "Direct Employer Link";
  }

  // Verification status & notes
  let verificationStatus = "VERIFIED";
  let verificationNote: string | undefined = undefined;

  if (typeof raw.verification_status === "string") {
    const rawStatus = raw.verification_status.trim();
    if (["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "DISCREPANCY", "POSSIBLY_CLOSED"].includes(rawStatus)) {
      verificationStatus = rawStatus;
    } else if (rawStatus === "VERIFIED_ROLE") {
      verificationStatus = "VERIFIED";
    } else {
      // Sentences from Block 1
      verificationNote = rawStatus;
      if (rawStatus.toLowerCase().includes("not independently confirmed") || rawStatus.toLowerCase().includes("partly supported")) {
        verificationStatus = "PARTIALLY_VERIFIED";
      } else if (rawStatus.toLowerCase().includes("deadline was")) {
        verificationStatus = "POSSIBLY_CLOSED";
      } else {
        verificationStatus = "VERIFIED";
      }
    }
  }

  if (typeof raw.verification_note === "string" && raw.verification_note.trim()) {
    verificationNote = raw.verification_note.trim();
  }

  // Check if possibly closed
  let isPossiblyClosed = verificationStatus === "POSSIBLY_CLOSED";
  const deadlineStr = typeof raw.deadline === "string" ? raw.deadline.trim() : null;
  if (deadlineStr) {
    const parsedDeadline = new Date(deadlineStr).getTime();
    if (!isNaN(parsedDeadline) && parsedDeadline < Date.now()) {
      isPossiblyClosed = true;
    }
  }
  if (verificationNote && verificationNote.toLowerCase().includes("deadline was")) {
    isPossiblyClosed = true;
  }

  // Graduation years
  let graduationYears: number[] | undefined = undefined;
  if (Array.isArray(raw.graduation_years) && raw.graduation_years.length > 0) {
    graduationYears = raw.graduation_years
      .map((y) => (typeof y === "number" ? y : parseInt(String(y), 10)))
      .filter((y) => !isNaN(y) && y >= 2020 && y <= 2035);
  }

  // Skills
  const requiredSkills: string[] = Array.isArray(raw.required_skills)
    ? raw.required_skills.filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
    : Array.isArray(raw.requiredSkills)
    ? (raw.requiredSkills as string[]).filter((s) => typeof s === "string" && Boolean(s.trim()))
    : [];

  const optionalSkills: string[] = Array.isArray(raw.preferred_skills)
    ? raw.preferred_skills.filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
    : Array.isArray(raw.optionalSkills)
    ? (raw.optionalSkills as string[]).filter((s) => typeof s === "string" && Boolean(s.trim()))
    : [];

  // Requirements & Responsibilities
  const responsibilities: string[] = Array.isArray(raw.responsibilities)
    ? raw.responsibilities.filter((r): r is string => typeof r === "string" && Boolean(r.trim()))
    : [];

  const requirements: string[] = [];
  if (responsibilities.length > 0) {
    requirements.push(...responsibilities.slice(0, 4));
  }
  if (requiredSkills.length > 0) {
    requirements.push(`Working knowledge in ${requiredSkills.slice(0, 3).join(", ")}`);
  }
  if (raw.education) {
    const eduStr = Array.isArray(raw.education) ? raw.education.join(", ") : String(raw.education);
    requirements.push(`Education: ${eduStr}`);
  }
  if (graduationYears && graduationYears.length > 0) {
    requirements.push(`Eligible graduation batches: ${graduationYears.join(", ")}`);
  }
  if (requirements.length === 0) {
    requirements.push("Strong problem solving and engineering fundamentals", "Demonstrated hands-on experience or coursework");
  }

  // Overview / Description
  let overview = "";
  if (typeof raw.description === "string" && raw.description.trim()) {
    overview = raw.description.trim();
  } else if (typeof raw.overview === "string" && raw.overview.trim()) {
    overview = raw.overview.trim();
  } else {
    overview = `${role} opportunity at ${company}. Explore role details and application channels verified via ${blockMetadata?.source || "Avsar Opportunity Feed"}.`;
  }

  // Experience
  let minExperienceMonths = 0;
  if (typeof raw.experience_min_years === "number") {
    minExperienceMonths = raw.experience_min_years * 12;
  } else if (typeof raw.minExperienceMonths === "number") {
    minExperienceMonths = raw.minExperienceMonths;
  }

  // Education requirement
  let educationRequirement = "Bachelor's degree or equivalent technical training";
  if (Array.isArray(raw.education) && raw.education.length > 0) {
    educationRequirement = raw.education.join(", ");
  } else if (typeof raw.education === "string" && raw.education.trim()) {
    educationRequirement = raw.education.trim();
  } else if (typeof raw.eligibility === "string" && raw.eligibility.trim()) {
    educationRequirement = raw.eligibility.trim();
  }

  // Department & Category
  const category = typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "Software Development";
  const department = category;

  // Benefits
  const benefits: string[] = [];
  if (raw.ppo_claim) {
    benefits.push("Pre-Placement Offer (PPO) opportunity on performance");
  }
  if (raw.benefits_claim && Array.isArray(raw.benefits_claim)) {
    benefits.push(...(raw.benefits_claim as string[]));
  }
  if (benefits.length === 0) {
    benefits.push("Competitive compensation", "Mentorship from experienced engineering peers", "Career development support");
  }

  const job: Job = {
    id: stableId,
    slug,
    title: role,
    company,
    companyLogoKey: normalizeCompanyLogoKey(company),
    heroImage: "/images/modern-office.jpg",
    location,
    workArrangement,
    employmentType,
    compensation: compResult.compensation,
    salaryDetails: compResult.salaryDetails,
    ctcClaim: compResult.ctcClaim,
    deadline: formatDeadline(deadlineStr),
    department,
    category,
    overview,
    requirements,
    responsibilities: responsibilities.length > 0 ? responsibilities : undefined,
    benefits,
    requiredSkills,
    optionalSkills,
    minExperienceMonths,
    educationRequirement,
    isFeatured: false,
    postedAt: blockMetadata?.checked_on ? `Checked ${blockMetadata.checked_on}` : "Recently Added",

    // Real dataset fields
    sourceJobId: rawJobId,
    sourcePlatform: blockMetadata?.source || (blockIndex === 0 ? "Employer Career Portal" : "SDE Jobs and Internships referral alerts"),
    graduationYears,
    applyUrl,
    applicationLinkType,
    verificationStatus,
    verificationNote,
    ppoClaim: typeof raw.ppo_claim === "boolean" ? raw.ppo_claim : typeof raw.ppo_claim === "string" ? raw.ppo_claim : undefined,
    isPossiblyClosed,
    isExternalApplication,
    sourceMetadata: {
      ...raw,
      blockIndex,
      importedAt: new Date().toISOString(),
    },
  };

  return { job };
}

/**
 * Extracts and normalizes all jobs from raw jobs.json text
 */
export function extractAllJobsFromDataset(text: string): {
  jobs: Job[];
  errors: Array<{ index: number; error: string }>;
  totalDiscovered: number;
} {
  const blocks = parseMultiJsonBlocks(text);
  const normalizedJobs: Job[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  let recordIndex = 0;

  for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
    const block = blocks[bIdx];

    if (Array.isArray(block)) {
      // Direct array of jobs (e.g. Block 1)
      for (const item of block) {
        if (!item || typeof item !== "object") {
          errors.push({ index: recordIndex++, error: "Item is not a valid JSON object." });
          continue;
        }
        const { job, error } = normalizeJobRecord(item as Record<string, unknown>, bIdx);
        if (error || !job) {
          errors.push({ index: recordIndex++, error: error || "Normalization failed." });
        } else {
          normalizedJobs.push(job);
          recordIndex++;
        }
      }
    } else if (block && typeof block === "object") {
      // Object with jobs array & metadata (e.g. Block 2)
      const obj = block as {
        jobs?: unknown[];
        source?: string;
        checked_on?: string;
        notice?: string;
      };
      const items = Array.isArray(obj.jobs) ? obj.jobs : [];
      const meta = { source: obj.source, checked_on: obj.checked_on, notice: obj.notice };

      for (const item of items) {
        if (!item || typeof item !== "object") {
          errors.push({ index: recordIndex++, error: "Item is not a valid JSON object." });
          continue;
        }
        const { job, error } = normalizeJobRecord(item as Record<string, unknown>, bIdx, meta);
        if (error || !job) {
          errors.push({ index: recordIndex++, error: error || "Normalization failed." });
        } else {
          normalizedJobs.push(job);
          recordIndex++;
        }
      }
    }
  }

  return {
    jobs: normalizedJobs,
    errors,
    totalDiscovered: recordIndex,
  };
}
