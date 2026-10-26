import test from "node:test";
import assert from "node:assert/strict";
import { SESSION_COOKIE_NAME, signSessionPayload } from "../src/lib/auth/session.ts";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

test("Integration: POST /api/resumes enforces maximum 5 resumes storage quota per candidate", async () => {
  const candidateId = `cand_quota_test_${Date.now()}`;
  const candidateSession = signSessionPayload({
    userId: candidateId,
    name: "Quota Tester",
    email: "quota@example.com",
    avatar: "/images/avatar.jpg",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  });

  // Upload 5 resumes via JSON fallback
  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`${BASE_URL}/api/resumes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${candidateSession}`,
      },
      body: JSON.stringify({
        fileName: `Resume_Doc_${i}.pdf`,
        fileSize: "1.0 MB",
      }),
    });
    assert.equal(res.status, 200, `Resume ${i} upload should succeed`);
  }

  // Attempt 6th upload - should be rejected with 400
  const excessRes = await fetch(`${BASE_URL}/api/resumes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${candidateSession}`,
    },
    body: JSON.stringify({
      fileName: "Resume_Doc_6.pdf",
      fileSize: "1.0 MB",
    }),
  });

  assert.equal(excessRes.status, 400, "6th resume upload must be rejected with 400");
  const data = await excessRes.json();
  assert.ok(data.error.includes("Maximum resume upload limit reached"), "Error must mention resume upload limit");
});
