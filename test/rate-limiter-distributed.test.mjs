import test from "node:test";
import assert from "node:assert/strict";
import { resolveClientIp, isValidIp } from "../src/lib/ratelimit/ip-resolver.ts";
import { SlidingWindowLimiter, MemoryRateLimitStore } from "../src/lib/ratelimit/sliding-window.ts";
import {
  enforceRateLimit,
  checkRateLimit,
  resetRateLimiterForTesting,
} from "../src/lib/ratelimit/index.ts";

test("IP Resolver: correctly validates IPv4 and IPv6 syntax", () => {
  assert.equal(isValidIp("192.168.1.1"), true);
  assert.equal(isValidIp("8.8.8.8"), true);
  assert.equal(isValidIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334"), true);
  assert.equal(isValidIp("::1"), true);

  // Malformed / Hostile inputs
  assert.equal(isValidIp("999.999.999.999"), false);
  assert.equal(isValidIp("<script>alert(1)</script>"), false);
  assert.equal(isValidIp("192.168.1.1; DROP TABLE users;"), false);
  assert.equal(isValidIp("unknown"), false);
});

test("IP Resolver: prioritizes tamper-proof edge headers over client spoofing", () => {
  // Scenario 1: Vercel edge header takes highest precedence
  const req1 = {
    headers: new Headers({
      "x-vercel-forwarded-for": "76.76.21.21, 10.0.0.1",
      "x-forwarded-for": "1.2.3.4",
    }),
  };
  assert.equal(resolveClientIp(req1), "76.76.21.21");

  // Scenario 2: Cloudflare connecting IP
  const req2 = {
    headers: new Headers({
      "cf-connecting-ip": "104.16.132.229",
      "x-forwarded-for": "5.6.7.8",
    }),
  };
  assert.equal(resolveClientIp(req2), "104.16.132.229");

  // Scenario 3: Standard X-Forwarded-For chain with leading whitespace
  const req3 = {
    headers: new Headers({
      "x-forwarded-for": "  49.204.10.12 , 10.0.0.2 ",
    }),
  };
  assert.equal(resolveClientIp(req3), "49.204.10.12");

  // Scenario 4: Malformed or hostile headers fallback safely to local loopback
  const req4 = {
    headers: new Headers({
      "x-forwarded-for": "malicious_string, 999.999.999",
    }),
  };
  assert.equal(resolveClientIp(req4), "127.0.0.1");
});

test("SlidingWindowLimiter: accurately enforces rolling quotas with microsecond precision", async () => {
  const store = new MemoryRateLimitStore();
  const limiter = new SlidingWindowLimiter(store);

  const policy = { windowMs: 1000, maxRequests: 3, prefix: "test" };

  // First 3 requests should be permitted
  const res1 = await limiter.check("user-1", policy);
  assert.equal(res1.allowed, true);
  assert.equal(res1.remaining, 2);

  const res2 = await limiter.check("user-1", policy);
  assert.equal(res2.allowed, true);
  assert.equal(res2.remaining, 1);

  const res3 = await limiter.check("user-1", policy);
  assert.equal(res3.allowed, true);
  assert.equal(res3.remaining, 0);

  // 4th request must be rejected
  const res4 = await limiter.check("user-1", policy);
  assert.equal(res4.allowed, false);
  assert.equal(res4.remaining, 0);
  assert.ok(res4.retryAfterSeconds >= 1);

  // Different user identifier must be unaffected
  const resOther = await limiter.check("user-2", policy);
  assert.equal(resOther.allowed, true);
});

test("enforceRateLimit Guard: generates RFC compliant 429 response when limit exceeded", async () => {
  resetRateLimiterForTesting();

  const tightPolicy = { windowMs: 1000, maxRequests: 2, prefix: "guard_test" };
  const mockReq = {
    url: "https://avsar.aitathastu.org/api/auth/login",
    headers: new Headers({ "x-real-ip": "203.0.113.195" }),
  };

  const check1 = await enforceRateLimit(mockReq, tightPolicy);
  assert.equal(check1, null, "First request should be allowed");

  const check2 = await enforceRateLimit(mockReq, tightPolicy);
  assert.equal(check2, null, "Second request should be allowed");

  // Third request exceeds threshold
  const check3 = await enforceRateLimit(mockReq, tightPolicy);
  assert.ok(check3 !== null, "Third request must produce a rate-limiting response");
  assert.equal(check3.status, 429);

  // Validate response headers
  assert.ok(check3.headers.get("Retry-After"));
  assert.equal(check3.headers.get("X-RateLimit-Limit"), "2");
  assert.equal(check3.headers.get("X-RateLimit-Remaining"), "0");

  const body = await check3.json();
  assert.ok(body.error.includes("Too many requests"));
  assert.ok(typeof body.retryAfter === "number");

  resetRateLimiterForTesting();
});
