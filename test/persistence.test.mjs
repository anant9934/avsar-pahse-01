import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

function calculateProfileCompletion(c) {
  let score = 0;
  if (c.avatar) score += 10;
  if (c.name && c.email && c.phone && c.location && c.headline) score += 20;
  if (c.skills && c.skills.length >= 5) score += 20;
  else if (c.skills && c.skills.length > 0) score += 10;
  if (c.education && c.education.length > 0) score += 20;
  if (c.experience && c.experience.length > 0) score += 15;
  if (c.projects && c.projects.length > 0) score += 15;
  return Math.min(100, score);
}

test("Persistence: Unique ID generation prevents batch import collisions", () => {
  const ids = new Set();
  const COUNT = 1000;
  for (let i = 0; i < COUNT; i++) {
    const id = `job_${randomUUID()}`;
    assert.ok(!ids.has(id), `Duplicate ID detected: ${id}`);
    ids.add(id);
  }
  assert.equal(ids.size, COUNT, "All 1000 IDs must be strictly unique");
});

test("Persistence: Atomic file write and backup generation", () => {
  const testDir = path.join(process.cwd(), "test_scratch");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  const testDbFile = path.join(testDir, "test_db.json");
  const testBakFile = path.join(testDir, "test_db.json.bak");

  const dataV1 = { version: 1, items: ["job_1"] };
  const dataV2 = { version: 2, items: ["job_1", "job_2"] };

  function atomicSave(data) {
    const tmp = path.join(testDir, `db.tmp.${process.pid}.${Date.now()}`);
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    if (fs.existsSync(testDbFile)) {
      fs.copyFileSync(testDbFile, testBakFile);
    }
    fs.renameSync(tmp, testDbFile);
  }

  // Save V1
  atomicSave(dataV1);
  assert.ok(fs.existsSync(testDbFile), "test_db.json must exist after save");
  assert.deepEqual(JSON.parse(fs.readFileSync(testDbFile, "utf-8")), dataV1);

  // Save V2
  atomicSave(dataV2);
  assert.ok(fs.existsSync(testBakFile), "Backup file test_db.json.bak must exist");
  assert.deepEqual(JSON.parse(fs.readFileSync(testBakFile, "utf-8")), dataV1, "Backup must contain previous version");
  assert.deepEqual(JSON.parse(fs.readFileSync(testDbFile, "utf-8")), dataV2, "Main file must contain new version");

  // Cleanup test scratch
  fs.rmSync(testDir, { recursive: true, force: true });
});

test("Persistence: Profile completion score recalculates dynamically", () => {
  const minimalCandidate = {
    avatar: "/images/avatar-rohan.jpg", // 10%
    name: "Rohan",
    email: "rohan@test.com",
    phone: "+91 9999999999",
    location: "Bengaluru",
    headline: "Developer", // +20%
    skills: ["React", "Node", "TS", "HTML", "CSS"], // +20%
    education: [{ degree: "B.Tech" }], // +20%
    experience: [], // 0
    projects: [{ title: "Proj" }], // +15%
  };

  // 10 + 20 + 20 + 20 + 0 + 15 = 85%
  assert.equal(calculateProfileCompletion(minimalCandidate), 85);

  // Add experience (+15%) => 100%
  minimalCandidate.experience.push({ role: "Intern" });
  assert.equal(calculateProfileCompletion(minimalCandidate), 100);
});

test("Persistence: Duplicate application submission detection", () => {
  const applications = [
    {
      id: "app_1",
      jobId: "job_google_fe_intern",
      candidateId: "cand_rohan_001",
      referenceNumber: "AVS-2025-0412-8937",
    },
  ];

  function submitApplication(sub, candidateId) {
    const existing = applications.find(
      (a) => a.jobId === sub.jobId && a.candidateId === candidateId
    );
    if (existing) {
      return {
        success: false,
        error: `You have already submitted an application for this role (${existing.referenceNumber}).`,
        existing,
      };
    }
    const newApp = {
      id: `app_${randomUUID()}`,
      jobId: sub.jobId,
      candidateId,
      referenceNumber: "AVS-2025-0412-9999",
    };
    applications.push(newApp);
    return { success: true, application: newApp };
  }

  // Attempt duplicate submission
  const dupResult = submitApplication({ jobId: "job_google_fe_intern" }, "cand_rohan_001");
  assert.equal(dupResult.success, false, "Duplicate submission must be rejected");
  assert.ok(dupResult.error.includes("already submitted"));

  // Submitting for a different job is allowed
  const newResult = submitApplication({ jobId: "job_flipkart_sde" }, "cand_rohan_001");
  assert.equal(newResult.success, true, "New job application must succeed");
});
