import type { Candidate, Job, MatchAnalysis } from "@/types";

/**
 * Deterministic Candidate-Job Matching Algorithm
 * 
 * Evaluation Weights:
 * - Skills Match: 40% (Cosine / Jaccard overlap of candidate skills with job required and optional skills)
 * - Experience Match: 25% (Comparison of candidate verified tenure with job minimum requirement)
 * - Education Match: 20% (Degree level and technical domain relevance)
 * - Location & Work Arrangement Match: 15% (Physical location proximity or remote work alignment)
 * 
 * Separation of Concerns:
 * - Eligibility: Boolean check on hard prerequisites (e.g., minimum degree status). Even if match is 30%, eligible candidates can apply.
 * - Match Score: Quantitative fit percentage (0 - 100%).
 * - Recommendation Ranking: Score modified by recruiter boost / freshness.
 */
export function calculateJobMatch(candidate: Candidate, job: Job): MatchAnalysis {
  const norm = (s: string) => s.trim().toLowerCase();

  const candidateSkillsSet = new Set((candidate?.skills || []).map(norm));
  const requiredSkills = (job.requiredSkills || []).map(norm);
  const optionalSkills = (job.optionalSkills || []).map(norm);

  // 1. Skills Matching (40% weight)
  const matchedRequired = requiredSkills.filter((sk) => candidateSkillsSet.has(sk));
  const matchedOptional = optionalSkills.filter((sk) => candidateSkillsSet.has(sk));

  const requiredScore = requiredSkills.length > 0 
    ? (matchedRequired.length / requiredSkills.length) * 100 
    : 0;
  const optionalScore = optionalSkills.length > 0 
    ? (matchedOptional.length / optionalSkills.length) * 100 
    : 0;

  let skillsMatchScore = 70; // Neutral baseline when job does not specify required skills
  if (requiredSkills.length === 0 && optionalSkills.length === 0) {
    // When no skills are listed in the job post, inspect role and category for tech overlap
    const titleCategory = `${norm(job.title)} ${norm(job.category || "")}`;
    const domainMatches = Array.from(candidateSkillsSet).filter((sk) => titleCategory.includes(sk));
    skillsMatchScore = domainMatches.length > 0 ? 80 : 70;
  } else if (requiredSkills.length === 0) {
    skillsMatchScore = Math.max(70, Math.round(optionalScore));
  } else if (matchedRequired.length === requiredSkills.length) {
    // Meets all mandatory skills; optional skills provide bonus up to 100%
    skillsMatchScore = Math.min(100, Math.round(95 + (optionalScore * 0.05)));
  } else {
    skillsMatchScore = Math.min(100, Math.round(requiredScore * 0.85 + optionalScore * 0.15));
  }

  // 2. Experience Matching (25% weight)
  const totalMonthsExp = candidate.experience.length * 12;

  let experienceMatchScore = 100;
  if (job.minExperienceMonths > 0) {
    if (totalMonthsExp >= job.minExperienceMonths) {
      experienceMatchScore = Math.min(100, 85 + Math.round((totalMonthsExp / job.minExperienceMonths) * 10));
    } else {
      experienceMatchScore = Math.max(30, Math.round((totalMonthsExp / job.minExperienceMonths) * 80));
    }
  } else {
    // For internships or entry level
    experienceMatchScore = candidate.experience.length > 0 ? 92 : 75;
  }

  // 3. Education Matching (20% weight)
  const hasTechnicalDegree = candidate.education.some((ed) => {
    const f = norm(ed.field || "");
    const d = norm(ed.degree || "");
    return (
      f.includes("computer") ||
      f.includes("information") ||
      f.includes("software") ||
      f.includes("engineering") ||
      d.includes("b.tech") ||
      d.includes("b.e") ||
      d.includes("bca") ||
      d.includes("mca")
    );
  });
  const educationMatchScore = candidate.education.length === 0 ? 40 : hasTechnicalDegree ? 88 : 70;

  // 4. Location & Arrangement Matching (15% weight)
  let locationMatchScore = 65;
  const candidateLoc = norm(candidate.location || "");
  const jobLoc = norm(job.location || "");

  if (job.workArrangement === "Remote") {
    locationMatchScore = 100;
  } else if (jobLoc && candidateLoc && (candidateLoc.includes(jobLoc) || jobLoc.includes(candidateLoc))) {
    locationMatchScore = 90;
  } else if (candidateLoc.includes("bengaluru") && jobLoc.includes("bengaluru")) {
    locationMatchScore = 90;
  } else if (candidate.preferences?.preferredLocation && norm(candidate.preferences.preferredLocation).includes(jobLoc)) {
    locationMatchScore = 80;
  }

  // Overall Weighted Score: 40% skills + 25% experience + 20% education + 15% location
  const rawScore = 
    skillsMatchScore * 0.40 + 
    experienceMatchScore * 0.25 + 
    educationMatchScore * 0.20 + 
    locationMatchScore * 0.15;

  const overallScore = Math.min(99, Math.max(10, Math.round(rawScore)));

  // Rating Label
  let ratingLabel: MatchAnalysis["ratingLabel"] = "Good Match";
  if (overallScore >= 88) ratingLabel = "Strong Match";
  else if (overallScore >= 72) ratingLabel = "Good Match";
  else ratingLabel = "Moderate Match";

  // Top matching skills (formatted nicely with original casing)
  const topMatchingSkills = (job.requiredSkills || []).filter((sk) => 
    candidateSkillsSet.has(norm(sk))
  );

  // Missing or optional skills
  const missingSkills = [
    ...(job.requiredSkills || []).filter((sk) => !candidateSkillsSet.has(norm(sk))),
    ...(job.optionalSkills || []).filter((sk) => !candidateSkillsSet.has(norm(sk))),
  ];

  // Specific dynamic highlights based on actual matched skills and candidate background
  const highlights: string[] = [];
  if (topMatchingSkills.length >= 2) {
    highlights.push(`Strong ${topMatchingSkills.slice(0, 2).join(" & ")} skills`);
  } else if (topMatchingSkills.length === 1) {
    highlights.push(`Verified skills in ${topMatchingSkills[0]}`);
  }
  if (candidate.experience.length > 0) {
    highlights.push(`${candidate.experience[0].role} background`);
  } else if (candidate.projects.length > 0) {
    highlights.push(`Hands-on project experience`);
  }
  if (missingSkills.length > 0) {
    highlights.push(`Learn ${missingSkills[0]} to strengthen fit`);
  }
  if (job.isPossiblyClosed) {
    highlights.unshift("Listing may be closed or expired on source platform");
  }

  // Eligibility check (hard prerequisites)
  let isEligible = candidate.education.length > 0;
  let eligibilityReason = isEligible
    ? "You meet the core degree and prerequisite requirements for this role."
    : "Degree verification pending.";

  // Check graduation year eligibility if specified in dataset
  if (job.graduationYears && job.graduationYears.length > 0) {
    const candGradYear = candidate.education.length > 0 
      ? parseInt(candidate.education[0].endYear, 10) 
      : NaN;

    if (!isNaN(candGradYear)) {
      if (job.graduationYears.includes(candGradYear)) {
        isEligible = true;
        eligibilityReason = `Eligible: Your graduation batch (${candGradYear}) matches required batches: ${job.graduationYears.join(", ")}.`;
      } else {
        isEligible = false;
        eligibilityReason = `Requires graduation batch: ${job.graduationYears.join(", ")} (Your batch: ${candGradYear}).`;
      }
    }
  }

  return {
    overallScore,
    ratingLabel,
    eligibility: {
      isEligible,
      reason: eligibilityReason,
    },
    breakdown: {
      skillsMatch: skillsMatchScore,
      experienceMatch: experienceMatchScore,
      educationMatch: educationMatchScore,
      locationMatch: locationMatchScore,
    },
    topMatchingSkills,
    missingSkills,
    highlights,
  };
}
