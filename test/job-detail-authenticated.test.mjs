import test from "node:test";
import assert from "node:assert/strict";
import { SESSION_COOKIE_NAME, signSessionPayload } from "../src/lib/auth/session.ts";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

test("Integration: GET /api/jobs/[id] computes match score and saved status for authenticated candidate", async () => {
  const jobId = "job_google_fe_intern";

  // 1. Fetch unauthenticated
  const unauthRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
  assert.equal(unauthRes.status, 200);
  const unauthData = await unauthRes.json();
  assert.ok(unauthData.job);
  assert.equal(unauthData.job.id, jobId);
  assert.ok(unauthData.match);
  assert.ok(typeof unauthData.match.overallScore === "number");

  // 2. Create signed candidate session for Rohan Sharma
  const rohanSession = signSessionPayload({
    userId: "cand_rohan_sharma_001",
    name: "Rohan Sharma",
    email: "rohan@example.com",
    avatar: "/images/avatar-rohan.jpg",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  });

  const rohanRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`, {
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${rohanSession}`,
    },
  });

  assert.equal(rohanRes.status, 200);
  const rohanData = await rohanRes.json();
  assert.ok(rohanData.job);
  assert.ok(rohanData.match);
  assert.ok(typeof rohanData.match.overallScore === "number");
  assert.ok(typeof rohanData.isSaved === "boolean");

  // 3. Request non-existent job ID returns 404
  const notFoundRes = await fetch(`${BASE_URL}/api/jobs/job_nonexistent_xyz_999`);
  assert.equal(notFoundRes.status, 404);
  const notFoundData = await notFoundRes.json();
  assert.equal(notFoundData.error, "Job not found");
});
