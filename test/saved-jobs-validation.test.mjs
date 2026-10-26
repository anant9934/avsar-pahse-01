import test from "node:test";
import assert from "node:assert/strict";
import { SESSION_COOKIE_NAME, signSessionPayload } from "../src/lib/auth/session.ts";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

test("Integration: POST /api/jobs/saved rejects non-existent job ID with 404", async () => {
  const candidateSession = signSessionPayload({
    userId: "cand_rohan_sharma_001",
    name: "Rohan Sharma",
    email: "rohan@example.com",
    avatar: "/images/avatar-rohan.jpg",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  });

  const res = await fetch(`${BASE_URL}/api/jobs/saved`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${candidateSession}`,
    },
    body: JSON.stringify({
      jobId: "job_totally_invalid_non_existent_12345",
    }),
  });

  assert.equal(res.status, 404, "Saving non-existent job must return 404");
  const data = await res.json();
  assert.ok(data.error.includes("not found"), "Error message should mention job not found");
});
