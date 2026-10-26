import test from "node:test";
import assert from "node:assert/strict";
import {
  isSessionExpired,
  signSessionPayload,
  verifySessionToken,
} from "../../src/lib/auth/session.ts";

test("Unit: isSessionExpired correctly evaluates expiration timestamps and skew", () => {
  const futureExp = Math.floor(Date.now() / 1000) + 3600;
  const pastExp = Math.floor(Date.now() / 1000) - 10;

  assert.equal(isSessionExpired({ exp: futureExp }), false, "Future session is not expired");
  assert.equal(isSessionExpired({ exp: pastExp }), true, "Past session is expired");

  // With clock skew leeway of 30 seconds, a session expired 10 seconds ago is tolerated
  assert.equal(
    isSessionExpired({ exp: pastExp }, { clockSkewSeconds: 30 }),
    false,
    "Past session within clock skew leeway is tolerated"
  );

  // A session expired 45 seconds ago exceeds 30-second skew leeway
  assert.equal(
    isSessionExpired({ exp: pastExp - 35 }, { clockSkewSeconds: 30 }),
    true,
    "Past session beyond clock skew leeway is expired"
  );
});

test("Unit: verifySessionToken enforces expiration and clock skew tolerance", () => {
  const now = Math.floor(Date.now() / 1000);
  const expiredPayload = {
    userId: "cand_test_expired",
    name: "Expired Candidate",
    email: "expired@example.com",
    avatar: "/images/avatar.jpg",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
    exp: now - 5, // expired 5 seconds ago
  };

  const token = signSessionPayload(expiredPayload);

  // Default verify (0s skew) should reject
  const resultDefault = verifySessionToken(token);
  assert.equal(resultDefault, null, "Default verification must reject expired token");

  // With 15s clock skew, should accept
  const resultWithSkew = verifySessionToken(token, { clockSkewSeconds: 15 });
  assert.ok(resultWithSkew, "Verification with clock skew should accept token within tolerance");
  assert.equal(resultWithSkew.userId, "cand_test_expired");
});
