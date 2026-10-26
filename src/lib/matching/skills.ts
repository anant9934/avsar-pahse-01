import type { Job, Candidate } from "../../types/index.ts";

const SKILL_CANONICAL_ALIASES: Record<string, string> = {
  reactjs: "react",
  react: "react",
  typescript: "typescript",
  ts: "typescript",
  javascript: "javascript",
  js: "javascript",
  nodejs: "node",
  node: "node",
  postgresql: "postgresql",
  postgres: "postgresql",
  pg: "postgresql",
  python: "python",
  py: "python",
  python3: "python",
  kubernetes: "kubernetes",
  k8s: "kubernetes",
  golang: "go",
  go: "go",
  mongodb: "mongodb",
  mongo: "mongodb",
  amazonwebservices: "aws",
  aws: "aws",
  googlecloud: "gcp",
  gcp: "gcp",
  nextjs: "nextjs",
  next: "nextjs",
  vuejs: "vue",
  vue: "vue",
  tailwindcss: "tailwind",
  tailwind: "tailwind",
  docker: "docker",
  graphql: "graphql",
  redux: "redux",
};

export function normSkill(str: string): string {
  const stripped = str.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  return SKILL_CANONICAL_ALIASES[stripped] || stripped;
}

export function calculateSkillsMatch(candidate: Candidate, job: Job): {
  score: number;
  matchedRequired: string[];
  topMatchingSkills: string[];
  missingSkills: string[];
} {
  const candidateSkillsSet = new Set(candidate.skills.map(normSkill));
  const requiredSkills = job.requiredSkills || [];
  const optionalSkills = job.optionalSkills || [];

  const matchedRequired = requiredSkills.filter((sk) => candidateSkillsSet.has(normSkill(sk)));
  const matchedOptional = optionalSkills.filter((sk) => candidateSkillsSet.has(normSkill(sk)));

  const requiredScore = requiredSkills.length > 0
    ? (matchedRequired.length / requiredSkills.length) * 100
    : 0;

  const optionalScore = optionalSkills.length > 0
    ? (matchedOptional.length / optionalSkills.length) * 100
    : 0;

  let skillsMatchScore = 70; // Neutral baseline when job does not specify required skills
  if (requiredSkills.length === 0 && optionalSkills.length === 0) {
    const titleCategory = `${normSkill(job.title)} ${normSkill(job.category || "")}`;
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
    candidateSkillsSet.has(normSkill(sk))
  );

  const missingSkills = [
    ...requiredSkills.filter((sk) => !candidateSkillsSet.has(normSkill(sk))),
    ...optionalSkills.filter((sk) => !candidateSkillsSet.has(normSkill(sk))),
  ];

  return {
    score: skillsMatchScore,
    matchedRequired,
    topMatchingSkills,
    missingSkills,
  };
}
