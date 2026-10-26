import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeReturnTo } from "../../src/lib/auth/url-sanitizer.ts";

test("Unit: sanitizeReturnTo allows valid internal relative paths", () => {
  assert.equal(sanitizeReturnTo("/explore"), "/explore");
  assert.equal(sanitizeReturnTo("/jobs/job-123"), "/jobs/job-123");
  assert.equal(sanitizeReturnTo("/home?filter=remote"), "/home?filter=remote");
});

test("Unit: sanitizeReturnTo rejects external absolute and protocol-relative URLs", () => {
  assert.equal(sanitizeReturnTo("https://evil.com"), "/home");
  assert.equal(sanitizeReturnTo("//evil.com/phish"), "/home");
  assert.equal(sanitizeReturnTo("javascript:alert(1)"), "/home");
});

test("Unit: sanitizeReturnTo rejects backslash evasion and CRLF injection", () => {
  assert.equal(sanitizeReturnTo("/\\evil.com"), "/home");
  assert.equal(sanitizeReturnTo("/%5cevil.com"), "/home");
  assert.equal(sanitizeReturnTo("/home\r\nSet-Cookie:hack=1"), "/home");
});
