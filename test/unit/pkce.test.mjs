import test from "node:test";
import assert from "node:assert/strict";
import { generatePKCE } from "../../src/lib/auth/pkce.ts";
import { createHash } from "node:crypto";

test("Unit: generatePKCE complies with RFC 7636", () => {
  const pkce = generatePKCE();

  // Verify entropy
  assert.ok(pkce.verifier.length >= 43, "Verifier must have at least 43 characters");
  assert.ok(pkce.state.length >= 32, "State must have high entropy");

  // Verify SHA-256 base64url challenge derivation
  const expectedChallenge = createHash("sha256").update(pkce.verifier).digest("base64url");
  assert.equal(pkce.challenge, expectedChallenge, "Challenge must be base64url(SHA256(verifier))");
});
