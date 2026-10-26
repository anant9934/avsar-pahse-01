import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseMultiJsonBlocks, extractAllJobsFromDataset, normalizeJobRecord } from "../src/lib/jobs/normalization.ts";
import { calculateJobMatch } from "../src/lib/matching.ts";
import { INITIAL_CANDIDATE } from "../src/lib/db/seed-data.ts";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const ADMIN_KEY = process.env.AVSAR_ADMIN_SECRET || "avsar_admin_secret_2025";

test("Dataset Integration: jobs.json multi-block parsing and normalization", () => {
  const rootDatasetPath = path.join(process.cwd(), "jobs.json");
  assert.ok(fs.existsSync(rootDatasetPath), "jobs.json must exist at root");

  const rawText = fs.readFileSync(rootDatasetPath, "utf-8");
  const blocks = parseMultiJsonBlocks(rawText);
  assert.equal(blocks.length, 2, "jobs.json must contain 2 distinct concatenated JSON blocks");

  const extraction = extractAllJobsFromDataset(rawText);
  assert.equal(extraction.totalDiscovered, 54, "Exactly 54 records must be discovered");
  assert.equal(extraction.jobs.length, 54, "All 54 records must be successfully normalized");
  assert.equal(extraction.errors.length, 0, "There must be zero unhandled normalization errors");

  // Check Block 1 (Employer Direct) vs Block 2 (Referral Alerts)
  const employerJobs = extraction.jobs.filter((j) => j.sourcePlatform === "Employer Career Portal");
  const referralJobs = extraction.jobs.filter((j) => j.sourcePlatform.includes("referral alerts"));
  assert.equal(employerJobs.length, 18, "Block 1 must have 18 employer jobs");
  assert.equal(referralJobs.length, 36, "Block 2 must have 36 referral alert jobs");
});

test("Dataset Integration: Stable ID and source metadata preservation", () => {
  const rawText = fs.readFileSync(path.join(process.cwd(), "jobs.json"), "utf-8");
  const { jobs } = extractAllJobsFromDataset(rawText);

  // Siemens job has job_id "526122"
  const siemens = jobs.find((j) => j.company.toLowerCase() === "siemens");
  assert.ok(siemens, "Siemens job must exist");
  assert.equal(siemens.id, "job_siemens_526122", "Job with source job_id must generate stable company_jobid ID");
  assert.equal(siemens.sourceJobId, "526122");
  assert.equal(siemens.verificationStatus, "VERIFIED");
  assert.equal(siemens.applicationLinkType, "Direct Employer Link");
  assert.ok(siemens.sourceMetadata, "Source metadata must be preserved for audit");

  // Appbrew job has no job_id
  const appbrew = jobs.find((j) => j.company.toLowerCase() === "appbrew");
  assert.ok(appbrew, "Appbrew job must exist");
  assert.equal(appbrew.id, "job_appbrew_associate-software-engineer-frontend");
  assert.equal(appbrew.verificationStatus, "POSSIBLY_CLOSED");
  assert.equal(appbrew.isPossiblyClosed, true, "POSSIBLY_CLOSED status must mark isPossiblyClosed = true");
});

test("Dataset Integration: Missing fields and malformed records resilience", () => {
  // Test record missing non-essential fields (no skills, no salary, no description)
  const minimal = {
    company: "Resilient Systems",
    role: "Junior Systems Associate",
  };
  const { job, error } = normalizeJobRecord(minimal, 0);
  assert.ifError(error);
  assert.ok(job);
  assert.equal(job.company, "Resilient Systems");
  assert.equal(job.compensation, "Competitive / Disclosed on Application");
  assert.equal(job.workArrangement, "Unspecified");
  assert.equal(job.requiredSkills.length, 0);
  assert.ok(job.requirements.length > 0, "Fallback requirements must be provided");

  // Test completely malformed record missing company
  const malformed = { role: "Orphaned Role" };
  const res = normalizeJobRecord(malformed, 0);
  assert.ok(res.error, "Should return an actionable error for missing company");
  assert.equal(res.job, undefined);
});

test("Matching Engine: Graduation-year constraint evaluation", () => {
  const candidate2025 = {
    ...INITIAL_CANDIDATE,
    education: [{ institution: "VTU", degree: "B.Tech", field: "CSE", startYear: "2021", endYear: "2025" }],
  };

  // Case A: Job requires future batches 2027, 2028 (e.g. PwC Consulting Intern 2027 or InstaPrepsAI)
  const futureJob = {
    id: "job_test_future",
    title: "Technology Consulting Intern",
    company: "PwC",
    requiredSkills: ["Problem Solving"],
    optionalSkills: [],
    minExperienceMonths: 0,
    educationRequirement: "B.Tech",
    graduationYears: [2027, 2028],
    location: "Bengaluru",
    workArrangement: "Hybrid",
  };

  const matchFuture = calculateJobMatch(candidate2025, futureJob);
  assert.equal(matchFuture.eligibility.isEligible, false, "Candidate from 2025 batch must be ineligible for 2027/2028 role");
  assert.ok(matchFuture.eligibility.reason.includes("2027, 2028"), "Reason must specify required batches");
  assert.ok(matchFuture.overallScore > 0, "Ineligible candidate must still receive objective background fit score");

  // Case B: Job includes candidate's batch 2025
  const eligibleJob = {
    ...futureJob,
    graduationYears: [2024, 2025, 2026],
  };
  const matchEligible = calculateJobMatch(candidate2025, eligibleJob);
  assert.equal(matchEligible.eligibility.isEligible, true, "Candidate in matching batch must be eligible");
  assert.ok(matchEligible.eligibility.reason.includes("2025"), "Reason must confirm candidate batch match");

  // Case C: Job with no graduation year restriction does not block candidate
  const unconstrainedJob = {
    ...futureJob,
    graduationYears: undefined,
  };
  const matchUnconstrained = calculateJobMatch(candidate2025, unconstrainedJob);
  assert.equal(matchUnconstrained.eligibility.isEligible, true, "Missing batch constraint must not block candidate");
});

test("Matching Engine: Neutral score for unlisted skills and closed listing warning", () => {
  const jobWithoutSkills = {
    id: "job_no_skills",
    title: "Junior Operations Associate",
    company: "Generic Corp",
    requiredSkills: [],
    optionalSkills: [],
    minExperienceMonths: 0,
    educationRequirement: "Degree",
    location: "Remote",
    workArrangement: "Remote",
    isPossiblyClosed: true,
  };

  const match = calculateJobMatch(INITIAL_CANDIDATE, jobWithoutSkills);
  assert.equal(match.breakdown.skillsMatch, 70, "Unspecified skills must assign neutral 70% fit rather than 100%");
  assert.ok(
    match.highlights.some((h) => h.toLowerCase().includes("closed") || h.toLowerCase().includes("expired")),
    "Closed listings must include closed warning in match highlights"
  );
});

test("Live API: Multi-field search and batch filtering over real dataset", async () => {
  // 1. Search by company
  const siemensRes = await fetch(`${BASE_URL}/api/jobs?q=Siemens`);
  assert.equal(siemensRes.status, 200);
  const siemensData = await siemensRes.json();
  assert.ok(siemensData.jobs.some((j) => j.company === "Siemens"), "Should find Siemens job");

  // 2. Search by category
  const aiRes = await fetch(`${BASE_URL}/api/jobs?category=artificial`);
  assert.equal(aiRes.status, 200);
  const aiData = await aiRes.json();
  assert.ok(aiData.jobs.length >= 1, "Should find AI category jobs");

  // 3. Filter by batch
  const batchRes = await fetch(`${BASE_URL}/api/jobs?batch=2027`);
  assert.equal(batchRes.status, 200);
  const batchData = await batchRes.json();
  assert.ok(batchData.jobs.length >= 1, "Should filter opportunities by 2027 graduation batch");

  // 4. Filter by verification status
  const verifiedRes = await fetch(`${BASE_URL}/api/jobs?verification=VERIFIED`);
  assert.equal(verifiedRes.status, 200);
  const verifiedData = await verifiedRes.json();
  assert.ok(
    verifiedData.jobs.every((j) => j.verificationStatus === "VERIFIED"),
    "All returned jobs must have VERIFIED status"
  );
});

test("Live API: External links and closed listing application rejection", async () => {
  // Appbrew is POSSIBLY_CLOSED
  const applyClosedRes = await fetch(`${BASE_URL}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: "job_appbrew_associate-software-engineer-frontend",
      resumeId: "res_1",
    }),
  });

  assert.equal(applyClosedRes.status, 409, "Closed jobs must reject applications with 409");
  const applyClosedData = await applyClosedRes.json();
  assert.ok(applyClosedData.error.includes("closed or expired"), "Error message must state role is closed");
});

test("Live API: Admin idempotent dataset ingestion and preview mode", async () => {
  // 1. Unauthorized admin request must fail
  const unauthRes = await fetch(`${BASE_URL}/api/admin/import-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "ingest_root" }),
  });
  assert.equal(unauthRes.status, 401, "Unauthenticated import must be denied with 401");

  // 2. Preview mode must report discovered items without writing
  const previewRes = await fetch(`${BASE_URL}/api/admin/import-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
    body: JSON.stringify({ action: "ingest_root", preview: true }),
  });
  assert.equal(previewRes.status, 200);
  const previewData = await previewRes.json();
  assert.equal(previewData.previewMode, true);
  assert.equal(previewData.totalDiscovered, 54, "Preview must discover all 54 records");
  assert.equal(previewData.rejected, 0, "Zero records rejected in preview");

  // 3. Repeated commit must report 0 duplicates and 54 unchanged
  const commitRes = await fetch(`${BASE_URL}/api/admin/import-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
    body: JSON.stringify({ action: "ingest_root", preview: false }),
  });
  assert.equal(commitRes.status, 200);
  const commitData = await commitRes.json();
  assert.equal(commitData.unchanged, 54, "All 54 jobs must be recognized as unchanged");
  assert.equal(commitData.duplicatesSkipped, 0, "No duplicate jobs created on repeated ingestion");
  assert.equal(commitData.rejected, 0, "No records rejected");
});
