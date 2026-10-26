import test from "node:test";
import assert from "node:assert/strict";
import { calculateSkillsMatch } from "../../src/lib/matching/skills.ts";

test("Unit: calculateSkillsMatch handles skill normalization and casing", () => {
  const candidate = {
    skills: ["React", "TypeScript", "Node.js", "Tailwind CSS"],
  };

  const job = {
    title: "Frontend Engineer",
    requiredSkills: ["react", "typescript"],
    optionalSkills: ["GraphQL"],
  };

  const result = calculateSkillsMatch(candidate, job);
  assert.equal(result.matchedRequired.length, 2);
  assert.ok(result.score >= 95, "Matching all required skills should yield top score");
  assert.deepEqual(result.missingSkills, ["GraphQL"]);
});

test("Unit: calculateSkillsMatch awards neutral score when job omits required skills", () => {
  const candidate = { skills: ["Python", "Django"] };
  const job = { title: "Software Engineer", requiredSkills: [], optionalSkills: [] };

  const result = calculateSkillsMatch(candidate, job);
  assert.ok(result.score >= 70 && result.score <= 80);
});

test("Unit: calculateSkillsMatch resolves canonical tech stack aliases and abbreviations", () => {
  const candidate = {
    skills: ["React.js", "TS", "Node.js", "k8s", "py"],
  };

  const job = {
    title: "Fullstack Platform Engineer",
    requiredSkills: ["React", "TypeScript", "Node", "Kubernetes", "Python"],
    optionalSkills: ["PostgreSQL"],
  };

  const result = calculateSkillsMatch(candidate, job);
  assert.equal(result.matchedRequired.length, 5, "All 5 alias-mapped skills should match");
  assert.ok(result.score >= 95, "Full match on required skills should award 95+ score");
});
