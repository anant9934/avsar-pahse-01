import test from "node:test";
import assert from "node:assert/strict";
import { slugify, generateStableJobId } from "../../src/lib/jobs/slugs.ts";

test("Unit: slugify converts arbitrary text to URL-safe alphanumeric slugs", () => {
  assert.equal(slugify("Google LLC"), "google-llc");
  assert.equal(slugify("Software Engineer / Frontend (Intern)"), "software-engineer-frontend-intern");
  assert.equal(slugify("  --Tata Digital & Swiggy!!--  "), "tata-digital-swiggy");
  assert.equal(slugify("AI Tathastu 2025"), "ai-tathastu-2025");
});

test("Unit: generateStableJobId produces deterministic IDs and slugs", () => {
  const result1 = generateStableJobId("Google", "Frontend Intern", "JOB_12345");
  assert.equal(result1.id, "job_google_job-12345");
  assert.equal(result1.slug, "frontend-intern-google-job-12345");

  const result2 = generateStableJobId("Microsoft", "Cloud Solutions Architect");
  assert.equal(result2.id, "job_microsoft_cloud-solutions-architect");
  assert.equal(result2.slug, "cloud-solutions-architect-microsoft");
});
