import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:3000";
const ADMIN_KEY = "avsar_admin_secret_2025";

test("Journey A — Candidate Browsing & Matching Flow", async () => {
  // 1. Pages respond 200
  const welcomeRes = await fetch(`${BASE_URL}/welcome`);
  assert.equal(welcomeRes.status, 200);

  const authRes = await fetch(`${BASE_URL}/auth`);
  assert.equal(authRes.status, 200);

  const homeRes = await fetch(`${BASE_URL}/home`);
  assert.equal(homeRes.status, 200);

  // 2. Search & filter jobs
  const searchRes = await fetch(`${BASE_URL}/api/jobs?q=frontend`);
  assert.equal(searchRes.status, 200);
  const searchData = await searchRes.json();
  assert.ok(searchData.jobs.length >= 1, "Should find at least one frontend job");

  // 3. Open job details & verify match score
  const jobRes = await fetch(`${BASE_URL}/api/jobs/job_google_fe_intern`);
  assert.equal(jobRes.status, 200);
  const jobData = await jobRes.json();
  assert.equal(jobData.job.id, "job_google_fe_intern");
  assert.equal(jobData.match.overallScore, 92, "Google FE Intern must have 92% match score");
  assert.equal(jobData.match.ratingLabel, "Strong Match");

  // 4. Toggle save job
  const saveRes = await fetch(`${BASE_URL}/api/jobs/saved`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: "job_google_fe_intern" }),
  });
  assert.equal(saveRes.status, 200);
  const saveData = await saveRes.json();
  assert.ok(typeof saveData.isSaved === "boolean");
});

test("Journey B — Resume Security & Application Submission", async () => {
  // 1. Attempt upload with fake executable payload disguised as PDF
  const fakePdfPayload = new FormData();
  const fakeFile = new Blob(["#!/bin/bash\necho 'malicious'"], { type: "application/pdf" });
  fakePdfPayload.append("file", fakeFile, "malicious.pdf");

  const rejectRes = await fetch(`${BASE_URL}/api/resumes`, {
    method: "POST",
    body: fakePdfPayload,
  });
  assert.equal(rejectRes.status, 400, "Fake PDF payload must be rejected by magic bytes check");
  const rejectData = await rejectRes.json();
  assert.ok(rejectData.error.includes("invalid document format") || rejectData.error.includes("signature"));

  // 2. Upload valid synthetic PDF
  const validPdfPayload = new FormData();
  const validFile = new Blob(["%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"], {
    type: "application/pdf",
  });
  validPdfPayload.append("file", validFile, "Rohan_Sharma_Verified.pdf");

  const uploadRes = await fetch(`${BASE_URL}/api/resumes`, {
    method: "POST",
    body: validPdfPayload,
  });
  assert.equal(uploadRes.status, 200, "Valid PDF must be accepted");
  const uploadData = await uploadRes.json();
  assert.ok(uploadData.resume.id);

  // 3. Submit application
  // Post temporary test job first
  const newJobRes = await fetch(`${BASE_URL}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
    body: JSON.stringify({
      title: `Software Intern ${Date.now()}`,
      company: "Test Journey Corp",
      location: "Bengaluru",
      workArrangement: "Hybrid",
      employmentType: "Internship",
      compensation: "₹35,000/month",
      deadline: "30 May 2025",
      requiredSkills: ["React"],
    }),
  });
  assert.equal(newJobRes.status, 201, "Job creation should return 201");
  const newJobData = await newJobRes.json();
  const targetJobId = newJobData.job.id;

  const appRes = await fetch(`${BASE_URL}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: targetJobId,
      resumeId: uploadData.resume.id,
      answers: { whyJoin: "Excited about engineering opportunities." },
    }),
  });
  assert.equal(appRes.status, 200, "Application submission should succeed");
  const appData = await appRes.json();
  assert.ok(appData.application.referenceNumber.startsWith("AVS-"));

  // 4. Duplicate submission rejection
  const dupRes = await fetch(`${BASE_URL}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: targetJobId,
      resumeId: uploadData.resume.id,
      answers: {},
    }),
  });
  assert.equal(dupRes.status, 409, "Duplicate submission must be rejected with 409 Conflict");
  const dupData = await dupRes.json();
  assert.ok(dupData.error.includes("already submitted"));
});

test("Journey C — Candidate Profile Editing & Recalculation", async () => {
  // 1. Get initial profile
  const initialRes = await fetch(`${BASE_URL}/api/profile`);
  assert.equal(initialRes.status, 200);
  const initialData = await initialRes.json();
  const originalHeadline = initialData.candidate.headline;

  // 2. Update profile headline
  const testHeadline = `Updated Senior Engineer ${Date.now()}`;
  const patchRes = await fetch(`${BASE_URL}/api/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headline: testHeadline }),
  });
  assert.equal(patchRes.status, 200);
  const patchData = await patchRes.json();
  assert.equal(patchData.candidate.headline, testHeadline);
  assert.ok(typeof patchData.candidate.profileCompletionPercentage === "number");

  // 3. Reload profile & verify persistence
  const reloadedRes = await fetch(`${BASE_URL}/api/profile`);
  const reloadedData = await reloadedRes.json();
  assert.equal(reloadedData.candidate.headline, testHeadline);

  // Restore original headline
  await fetch(`${BASE_URL}/api/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headline: originalHeadline }),
  });
});

test("Journey D — Admin Authorization & JSON Job Import", async () => {
  // 1. Unauthorized access to admin metrics rejected
  const unauthRes = await fetch(`${BASE_URL}/api/admin/metrics`);
  assert.equal(unauthRes.status, 401, "Unauthenticated request to metrics must return 401");

  // 2. Authorized access with admin key
  const authRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
    headers: { "x-admin-key": ADMIN_KEY },
  });
  assert.equal(authRes.status, 200, "Authorized request must return 200");
  const metricsData = await authRes.json();
  assert.ok(metricsData.metrics.totalJobs > 0);

  // 3. Post job validation (missing deadline rejected)
  const invalidJobRes = await fetch(`${BASE_URL}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
    body: JSON.stringify({
      title: "No Deadline Job",
      company: "Acme",
      deadline: "", // Invalid empty deadline
    }),
  });
  assert.equal(invalidJobRes.status, 400, "Job without deadline must be rejected with 400");

  // 4. Test invalid JSON import
  const invalidImportRes = await fetch(`${BASE_URL}/api/admin/import-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
    body: JSON.stringify({ notAnArray: true }),
  });
  assert.equal(invalidImportRes.status, 400, "Non-array JSON import must be rejected with 400");

  // 5. Test valid JSON import with test dataset
  const testBatch = [
    {
      company: "Test Import Corp " + Date.now(),
      role: "Platform Engineer",
      location: ["Bengaluru, India"],
      work_model: "Hybrid",
      required_skills: ["Go", "Kubernetes", "Linux"],
      description: "Build robust distributed backend infrastructure.",
      salary: "₹50,000/month",
      deadline: "30 Jun 2025",
    },
  ];

  const importRes = await fetch(`${BASE_URL}/api/admin/import-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
    body: JSON.stringify(testBatch),
  });
  assert.equal(importRes.status, 200, "Valid batch import must succeed");
  const importData = await importRes.json();
  assert.equal(importData.importedCount, 1, "Should have imported 1 job");

  // 6. Test duplicate import detection
  const duplicateImportRes = await fetch(`${BASE_URL}/api/admin/import-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": ADMIN_KEY,
    },
    body: JSON.stringify(testBatch),
  });
  assert.equal(duplicateImportRes.status, 200);
  const dupImportData = await duplicateImportRes.json();
  assert.equal(dupImportData.importedCount, 0, "Duplicate job must not be re-imported");
  assert.equal(dupImportData.duplicatesSkipped, 1, "Duplicate job must be recorded in duplicatesSkipped");
});
