import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeReturnTo, sanitizeExternalUrl } from "../../src/lib/auth/url-sanitizer.ts";

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

test("Unit: sanitizeExternalUrl allows valid HTTPS, HTTP, and mailto links", () => {
  assert.equal(
    sanitizeExternalUrl("https://careers.google.com/jobs/123?source=avsar"),
    "https://careers.google.com/jobs/123?source=avsar"
  );
  assert.equal(sanitizeExternalUrl("http://company.org/careers"), "http://company.org/careers");
  assert.equal(sanitizeExternalUrl("mailto:hiring@techcorp.in"), "mailto:hiring@techcorp.in");
});

test("Unit: sanitizeExternalUrl rejects dangerous schemes and XSS injection vectors", () => {
  assert.equal(sanitizeExternalUrl("javascript:alert(document.cookie)"), null);
  assert.equal(sanitizeExternalUrl("JAVASCRIPT:alert(1)"), null);
  assert.equal(sanitizeExternalUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(sanitizeExternalUrl("vbscript:MsgBox(1)"), null);
  assert.equal(sanitizeExternalUrl("file:///etc/passwd"), null);
});

test("Unit: sanitizeExternalUrl rejects credentials, control characters, and malformed URLs", () => {
  assert.equal(sanitizeExternalUrl("https://user:pass@evil.com/phish"), null);
  assert.equal(sanitizeExternalUrl("https://example.com/apply\r\nInjected-Header:1"), null);
  assert.equal(sanitizeExternalUrl("not a valid url"), null);
  assert.equal(sanitizeExternalUrl(""), null);
  assert.equal(sanitizeExternalUrl(null), null);
  assert.equal(sanitizeExternalUrl(undefined), null);
});
