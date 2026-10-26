import test from "node:test";
import assert from "node:assert/strict";
import { SESSION_COOKIE_NAME, signSessionPayload } from "../src/lib/auth/session.ts";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

test("Integration: POST /api/applications rejects submission for non-existent job ID with 404", async () => {
  const candidateSession = signSessionPayload({
    userId: "cand_rohan_sharma_001",
    name: "Rohan Sharma",
    email: "rohan@example.com",
    avatar: "/images/avatar-rohan.jpg",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  });

  const res = await fetch(`${BASE_URL}/api/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${candidateSession}`,
    },
    body: JSON.stringify({
      jobId: "job_completely_fictional_non_existent_9999",
      answers: { whyJoin: "Test" },
    }),
  });

  assert.equal(res.status, 404, "Submitting to non-existent job must return 404");
  const data = await res.json();
  assert.ok(data.error.includes("not found"), "Error message should mention job not found");
});

test("Integration: POST /api/applications rejects attaching another candidate's resume with 403", async () => {
  // Session for Candidate Alpha
  const candidateAlphaSession = signSessionPayload({
    userId: "cand_alpha_test_owner",
    name: "Candidate Alpha",
    email: "alpha@example.com",
    avatar: "/images/avatar.jpg",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  });

  // Rohan Sharma's resume is res_1 (owned by cand_rohan_sharma_001)
  const res = await fetch(`${BASE_URL}/api/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${candidateAlphaSession}`,
    },
    body: JSON.stringify({
      jobId: "job_google_fe_intern",
      resumeId: "res_1",
      answers: { whyJoin: "Test" },
    }),
  });

  assert.equal(res.status, 403, "Submitting another candidate's resume must return 403 Forbidden");
  const data = await res.json();
  assert.ok(data.error.includes("Forbidden"), "Error message must indicate forbidden access");
});
