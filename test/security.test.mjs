import test from "node:test";
import assert from "node:assert/strict";

// Helper for open redirect check
function sanitizeReturnTo(rawReturnTo) {
  const isSafeRelativeUrl =
    rawReturnTo &&
    rawReturnTo.startsWith("/") &&
    !rawReturnTo.startsWith("//") &&
    !rawReturnTo.startsWith("/\\");
  return isSafeRelativeUrl ? rawReturnTo : "/home";
}

// Helper for magic bytes validation
function validateDocumentSignature(buffer, ext) {
  if (!buffer || buffer.length < 4) return false;

  if (ext === ".pdf") {
    const header = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("latin1");
    return header.includes("%PDF-");
  }

  if (ext === ".docx") {
    return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  if (ext === ".doc") {
    return buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
  }

  return false;
}

test("Security: Open Redirect prevention", () => {
  const maliciousUrls = [
    "https://evil.com",
    "http://attacker.com/steal-token",
    "//evil.com/hack",
    "/\\evil.com",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "",
    null,
    undefined,
  ];

  for (const url of maliciousUrls) {
    const sanitized = sanitizeReturnTo(url);
    assert.equal(sanitized, "/home", `Malicious URL "${url}" must be sanitized to /home`);
  }

  const legitimateUrls = [
    "/home",
    "/explore?q=react",
    "/jobs/job_google_fe_intern",
    "/profile",
    "/applications",
  ];

  for (const url of legitimateUrls) {
    const sanitized = sanitizeReturnTo(url);
    assert.equal(sanitized, url, `Legitimate relative URL "${url}" should be preserved`);
  }
});

test("Security: Magic bytes document validation", () => {
  // 1. Genuine PDF
  const genuinePdf = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
  assert.equal(validateDocumentSignature(genuinePdf, ".pdf"), true, "Valid PDF must pass magic bytes check");

  // 2. Fake PDF (actually a shell script or HTML)
  const fakePdfScript = Buffer.from("#!/bin/bash\nrm -rf /tmp/test\n");
  assert.equal(validateDocumentSignature(fakePdfScript, ".pdf"), false, "Fake PDF containing bash script must be rejected");

  const fakePdfHtml = Buffer.from("<html><script>evil()</script></html>");
  assert.equal(validateDocumentSignature(fakePdfHtml, ".pdf"), false, "Fake PDF containing HTML must be rejected");

  // 3. Genuine DOCX (ZIP archive header PK\x03\x04)
  const genuineDocx = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
  assert.equal(validateDocumentSignature(genuineDocx, ".docx"), true, "Valid DOCX must pass PK zip header check");

  // 4. Fake DOCX (plain text)
  const fakeDocx = Buffer.from("This is just plain text masquerading as docx");
  assert.equal(validateDocumentSignature(fakeDocx, ".docx"), false, "Plain text masquerading as DOCX must be rejected");

  // 5. Short/empty buffer
  assert.equal(validateDocumentSignature(Buffer.from([]), ".pdf"), false, "Empty buffer must be rejected");
  assert.equal(validateDocumentSignature(Buffer.from([0x25, 0x50]), ".pdf"), false, "Truncated buffer must be rejected");
});

test("Security: Admin authorization verification", () => {
  const ADMIN_SECRET = "avsar_admin_secret_2025";

  function checkAdmin(headers, cookies) {
    if (headers["x-admin-key"] === ADMIN_SECRET) {
      return { authorized: true };
    }
    if (cookies["avsar_admin_session"]) {
      try {
        const parsed = JSON.parse(cookies["avsar_admin_session"]);
        if (parsed.role === "admin" || parsed.isAdmin === true) {
          return { authorized: true };
        }
      } catch {}
    }
    return { authorized: false, reason: "Unauthorized: Admin privileges required" };
  }

  // Unauthorized guest
  assert.equal(checkAdmin({}, {}).authorized, false, "Guest without credentials must be unauthorized");

  // Wrong secret key
  assert.equal(checkAdmin({ "x-admin-key": "wrong_key" }, {}).authorized, false, "Wrong admin key must be rejected");

  // Valid secret key
  assert.equal(checkAdmin({ "x-admin-key": ADMIN_SECRET }, {}).authorized, true, "Valid admin key must be authorized");

  // Valid admin cookie
  const validCookie = JSON.stringify({ role: "admin", isAdmin: true });
  assert.equal(checkAdmin({}, { "avsar_admin_session": validCookie }).authorized, true, "Valid admin session cookie must be authorized");
});

test("Security: Demo authentication environment guard", () => {
  function isDemoAllowed(env, allowDemoAuthFlag) {
    return env !== "production" || allowDemoAuthFlag === "true";
  }

  // Development: allowed
  assert.equal(isDemoAllowed("development", undefined), true, "Demo auth should be allowed in development");

  // Test environment: allowed
  assert.equal(isDemoAllowed("test", undefined), true, "Demo auth should be allowed in test");

  // Production without flag: blocked
  assert.equal(isDemoAllowed("production", undefined), false, "Demo auth must be blocked in production by default");
  assert.equal(isDemoAllowed("production", "false"), false, "Demo auth must be blocked in production when flag is false");

  // Production with explicit opt-in: allowed
  assert.equal(isDemoAllowed("production", "true"), true, "Demo auth allowed only when ALLOW_DEMO_AUTH is explicitly true");
});
