import type { Job, Candidate } from "../../types/index.ts";

function norm(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

export function calculateSkillsMatch(candidate: Candidate, job: Job): {
  score: number;
  matchedRequired: string[];
  topMatchingSkills: string[];
  missingSkills: string[];
} {
  const candidateSkillsSet = new Set(candidate.skills.map(norm));
  const requiredSkills = job.requiredSkills || [];
  const optionalSkills = job.optionalSkills || [];

  const matchedRequired = requiredSkills.filter((sk) => candidateSkillsSet.has(norm(sk)));
  const matchedOptional = optionalSkills.filter((sk) => candidateSkillsSet.has(norm(sk)));

  const requiredScore = requiredSkills.length > 0
    ? (matchedRequired.length / requiredSkills.length) * 100
    : 0;

  const optionalScore = optionalSkills.length > 0
    ? (matchedOptional.length / optionalSkills.length) * 100
    : 0;

  let skillsMatchScore = 70; // Neutral baseline when job does not specify required skills
  if (requiredSkills.length === 0 && optionalSkills.length === 0) {
    const titleCategory = `${norm(job.title)} ${norm(job.category || "")}`;
    const domainMatches = Array.from(candidateSkillsSet).filter((sk) => titleCategory.includes(sk));
    skillsMatchScore = domainMatches.length > 0 ? 80 : 70;
  } else if (requiredSkills.length === 0) {
    skillsMatchScore = Math.max(70, Math.round(optionalScore));
  } else if (matchedRequired.length === requiredSkills.length) {
    skillsMatchScore = Math.min(100, Math.round(95 + (optionalScore * 0.05)));
  } else {
    skillsMatchScore = Math.min(100, Math.round(requiredScore * 0.85 + optionalScore * 0.15));
  }

  const topMatchingSkills = requiredSkills.filter((sk) =>
    candidateSkillsSet.has(norm(sk))
  );

  const missingSkills = [
    ...requiredSkills.filter((sk) => !candidateSkillsSet.has(norm(sk))),
    ...optionalSkills.filter((sk) => !candidateSkillsSet.has(norm(sk))),
  ];

  return {
    score: skillsMatchScore,
    matchedRequired,
    topMatchingSkills,
    missingSkills,
  };
}
