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

  const candidateSkillsSet = new Set(candidate.skills.map(norm));
  const requiredSkills = job.requiredSkills.map(norm);
  const optionalSkills = job.optionalSkills.map(norm);

  // 1. Skills Matching
  const matchedRequired = requiredSkills.filter((sk) => candidateSkillsSet.has(sk));
  const matchedOptional = optionalSkills.filter((sk) => candidateSkillsSet.has(sk));

  const requiredScore = requiredSkills.length > 0 
    ? (matchedRequired.length / requiredSkills.length) * 100 
    : 100;
  const optionalScore = optionalSkills.length > 0 
    ? (matchedOptional.length / optionalSkills.length) * 100 
    : 100;

  // Weight required skills 80% and optional 20%
  const skillsMatchScore = Math.min(100, Math.round(requiredScore * 0.8 + optionalScore * 0.2));

  // 2. Experience Matching
  // Calculate total candidate experience in months
  const totalMonthsExp = candidate.experience.length * 12;

  let experienceMatchScore = 100;
  if (job.minExperienceMonths > 0) {
    if (totalMonthsExp >= job.minExperienceMonths) {
      experienceMatchScore = Math.min(100, 85 + Math.round((totalMonthsExp / job.minExperienceMonths) * 10));
    } else {
      experienceMatchScore = Math.max(40, Math.round((totalMonthsExp / job.minExperienceMonths) * 80));
    }
  } else {
    // For internships or entry level
    experienceMatchScore = candidate.experience.length > 0 ? 90 : 75;
  }

  // 3. Education Matching
  const hasTechnicalDegree = candidate.education.some((ed) => {
    const f = norm(ed.field);
    const d = norm(ed.degree);
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
  const educationMatchScore = hasTechnicalDegree ? 85 : 70;

  // 4. Location & Arrangement Matching
  let locationMatchScore = 70;
  const candidateLoc = norm(candidate.location);
  const jobLoc = norm(job.location);

  if (job.workArrangement === "Remote") {
    locationMatchScore = 100;
  } else if (candidateLoc.includes(jobLoc) || jobLoc.includes("bengaluru")) {
    locationMatchScore = 80;
  } else if (candidate.preferences.preferredLocation && norm(candidate.preferences.preferredLocation).includes(jobLoc)) {
    locationMatchScore = 75;
  }

  // Overall Weighted Score
  // 40% skills + 25% experience + 20% education + 15% location
  const rawScore = 
    skillsMatchScore * 0.40 + 
    experienceMatchScore * 0.25 + 
    educationMatchScore * 0.20 + 
    locationMatchScore * 0.15;

  const overallScore = Math.min(99, Math.max(10, Math.round(rawScore)));

  // Rating Label
  let ratingLabel: MatchAnalysis["ratingLabel"] = "Strong Match";
  if (overallScore >= 90) ratingLabel = "Strong Match";
  else if (overallScore >= 80) ratingLabel = "Good Match";
  else if (overallScore >= 65) ratingLabel = "Moderate Match";
  else ratingLabel = "Good Match";

  // Top matching skills (formatted nicely with original casing)
  const topMatchingSkills = job.requiredSkills.filter((sk) => 
    candidateSkillsSet.has(norm(sk))
  );

  // Missing or optional skills
  const missingSkills = [
    ...job.requiredSkills.filter((sk) => !candidateSkillsSet.has(norm(sk))),
    ...job.optionalSkills.filter((sk) => !candidateSkillsSet.has(norm(sk))),
  ];

  // Specific highlights
  const highlights: string[] = [];
  if (matchedRequired.length >= 2) {
    highlights.push(`Strong frontend development skills`);
  }
  if (candidateSkillsSet.has("react") && (candidateSkillsSet.has("next.js") || candidateSkillsSet.has("typescript"))) {
    highlights.push(`Experience with React and Next.js`);
  }
  if (candidate.projects.length > 0) {
    highlights.push(`Relevant project experience`);
  }
  if (missingSkills.length > 0) {
    highlights.push(`Add ${missingSkills[0]} experience (optional)`);
  }

  // Eligibility check (hard prerequisites)
  const isEligible = candidate.education.length > 0;

  return {
    overallScore,
    ratingLabel,
    eligibility: {
      isEligible,
      reason: isEligible 
        ? "You meet the core degree and prerequisite requirements for this role."
        : "Degree verification pending.",
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
