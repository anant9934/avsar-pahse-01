import test from "node:test";
import assert from "node:assert/strict";
import { checkAdminRateLimit, resetAdminRateLimits } from "../../src/lib/auth/rate-limiter.ts";

test("Unit: checkAdminRateLimit enforces sliding window threshold and returns retry-after", () => {
  resetAdminRateLimits();
  const testIp = "192.168.1.100";

  // First 10 attempts should be allowed
  for (let i = 0; i < 10; i++) {
    const res = checkAdminRateLimit(testIp);
    assert.equal(res.allowed, true, `Attempt ${i + 1} should be permitted`);
  }

  // 11th attempt should be blocked
  const blockedRes = checkAdminRateLimit(testIp);
  assert.equal(blockedRes.allowed, false, "11th attempt must be blocked");
  assert.ok(blockedRes.retryAfterSeconds && blockedRes.retryAfterSeconds > 0);

  resetAdminRateLimits();
});
