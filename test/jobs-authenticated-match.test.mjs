import test from "node:test";
import assert from "node:assert/strict";
import { SESSION_COOKIE_NAME, signSessionPayload } from "../src/lib/auth/session.ts";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

test("Integration: GET /api/jobs computes dynamic match scores for authenticated candidates", async () => {
  // 1. Fetch unauthenticated
  const unauthRes = await fetch(`${BASE_URL}/api/jobs?limit=5`);
  assert.equal(unauthRes.status, 200);
  const unauthData = await unauthRes.json();
  assert.ok(Array.isArray(unauthData.jobs));
  assert.ok(unauthData.jobs.length > 0);
  assert.ok(typeof unauthData.jobs[0].matchScore === "number");

  // 2. Create signed candidate session for Rohan Sharma
  const candidateSession = signSessionPayload({
    userId: "cand_rohan_sharma_001",
    name: "Rohan Sharma",
    email: "rohan@example.com",
    avatar: "/images/avatar-rohan.jpg",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  });

  const authRes = await fetch(`${BASE_URL}/api/jobs?limit=5`, {
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${candidateSession}`,
    },
  });

  assert.equal(authRes.status, 200);
  const authData = await authRes.json();
  assert.ok(Array.isArray(authData.jobs));
  assert.equal(authData.jobs.length, 5);
  for (const job of authData.jobs) {
    assert.ok(typeof job.matchScore === "number");
    assert.ok(job.matchScore >= 0 && job.matchScore <= 100);
    assert.ok(typeof job.matchLabel === "string");
  }
});
