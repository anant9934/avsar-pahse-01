import type { Candidate, Job, MatchAnalysis } from "../types/index.ts";
import { calculateSkillsMatch } from "./matching/skills.ts";
import { calculateLocationMatch } from "./matching/location.ts";
import { calculateExperienceMatch } from "./matching/experience.ts";
import { calculateEducationMatch } from "./matching/education.ts";
import { evaluateEligibility } from "./matching/eligibility.ts";
import { generateMatchHighlights } from "./matching/highlights.ts";

export {
  calculateSkillsMatch,
  calculateLocationMatch,
  calculateExperienceMatch,
  calculateEducationMatch,
  evaluateEligibility,
  generateMatchHighlights,
};

/**
 * Calculates deterministic match analysis between a Candidate profile and a Job listing.
 * Calibrated strictly to ensure 100% reproducibility and verified ranking.
 */
export function calculateJobMatch(candidate: Candidate, job: Job): MatchAnalysis {
  // 1. Skills Matching (40% weight)
  const skillsResult = calculateSkillsMatch(candidate, job);

  // 2. Experience Matching (25% weight)
  const experienceMatchScore = calculateExperienceMatch(candidate, job);

  // 3. Education Matching (20% weight)
  const educationMatchScore = calculateEducationMatch(candidate);

  // 4. Location & Arrangement Matching (15% weight)
  const locationMatchScore = calculateLocationMatch(candidate, job);

  // Overall Weighted Score: 40% skills + 25% experience + 20% education + 15% location
  const rawScore =
    skillsResult.score * 0.40 +
    experienceMatchScore * 0.25 +
    educationMatchScore * 0.20 +
    locationMatchScore * 0.15;

  const overallScore = Math.min(99, Math.max(10, Math.round(rawScore)));

  // Rating Label
  let ratingLabel: MatchAnalysis["ratingLabel"] = "Good Match";
  if (overallScore >= 88) ratingLabel = "Strong Match";
  else if (overallScore >= 72) ratingLabel = "Good Match";
  else ratingLabel = "Moderate Match";

  // Dynamic Highlights
  const highlights = generateMatchHighlights(
    candidate,
    job,
    skillsResult.topMatchingSkills,
    skillsResult.missingSkills
  );

  // Eligibility Evaluation
  const eligibility = evaluateEligibility(candidate, job);

  return {
    overallScore,
    ratingLabel,
    eligibility,
    breakdown: {
      skillsMatch: skillsResult.score,
      experienceMatch: experienceMatchScore,
      educationMatch: educationMatchScore,
      locationMatch: locationMatchScore,
    },
    highlights,
    missingSkills: skillsResult.missingSkills,
    topMatchingSkills: skillsResult.topMatchingSkills,
  };
}
