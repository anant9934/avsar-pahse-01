export interface MatchAnalysis {
  overallScore: number;
  ratingLabel: "Strong Match" | "Good Match" | "Moderate Match";
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
  highlights: string[];
  missingSkills: string[];
  topMatchingSkills: string[];
}
