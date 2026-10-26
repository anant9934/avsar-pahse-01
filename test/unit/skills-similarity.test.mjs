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

  const result = calculateSkillsMatch(candidate as any, job as any);
  assert.equal(result.matchedRequired.length, 2);
  assert.ok(result.score >= 95, "Matching all required skills should yield top score");
  assert.deepEqual(result.missingSkills, ["GraphQL"]);
});

test("Unit: calculateSkillsMatch awards neutral score when job omits required skills", () => {
  const candidate = { skills: ["Python", "Django"] };
  const job = { title: "Software Engineer", requiredSkills: [], optionalSkills: [] };

  const result = calculateSkillsMatch(candidate as any, job as any);
  assert.ok(result.score >= 70 && result.score <= 80);
});
