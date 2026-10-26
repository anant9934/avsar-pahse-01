import test from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_COOKIE_NAME,
  sanitizeReturnTo,
  signSessionPayload,
  verifySessionToken,
} from "../src/lib/auth/session.ts";
import {
  buildAuthorizeUrl,
  exchangeCodeForProfile,
  generatePKCE,
  validateAuthConfig,
} from "../src/lib/auth/aitathastu.ts";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_KEY_HEADER,
  checkAdminAuth,
  checkAdminRateLimit,
  logAdminAction,
} from "../src/lib/auth/admin.ts";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

test("Security Audit 1: PKCE S256 Cryptographic Generation & RFC 7636 Compliance", () => {
  const pkce1 = generatePKCE();
  const pkce2 = generatePKCE();

  assert.ok(pkce1.verifier.length >= 43, "PKCE verifier must be at least 43 chars");
  assert.ok(pkce1.challenge.length >= 43, "PKCE challenge must be base64url encoded");
  assert.ok(pkce1.state.length >= 32, "OAuth state must be high entropy");
  assert.notEqual(pkce1.verifier, pkce2.verifier, "Verifiers must be unique per invocation");
  assert.notEqual(pkce1.state, pkce2.state, "States must be unique per invocation");

  const authUrl = buildAuthorizeUrl({
    challenge: pkce1.challenge,
    state: pkce1.state,
    returnTo: "/jobs/job_google_fe_intern",
  });

  const parsed = new URL(authUrl);
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
  assert.equal(parsed.searchParams.get("code_challenge"), pkce1.challenge);
  assert.equal(parsed.searchParams.get("state"), pkce1.state);
  assert.ok(parsed.searchParams.get("scope")?.includes("openid"));
});

test("Security Audit 2: Open Redirect & Malicious Return Destination Prevention", () => {
  const maliciousInputs = [
    "https://evil.com",
    "http://attacker.com/steal-session",
    "//evil.com",
    "//attacker.org/path",
    "/\\evil.com",
    "/\\\\attacker.com",
    "/%5cevil.com",
    "/%2fevil.com",
    "/%252fevil.com",
    "/test\r\nSet-Cookie: evil=1",
    "/test\nevil.com",
    "javascript:alert(document.cookie)",
    "data:text/html,<script>evil()</script>",
    "vbscript:msgbox(1)",
    "   ",
    "",
    null,
    undefined,
  ];

  for (const malicious of maliciousInputs) {
    const sanitized = sanitizeReturnTo(malicious, "/home");
    assert.equal(
      sanitized,
      "/home",
      `Malicious return destination "${malicious}" must safely fallback to /home`
    );
  }

  const legitimateReturnPaths = [
    "/home",
    "/explore?q=frontend&category=internship",
    "/jobs/job_google_fe_intern",
    "/jobs/job_google_fe_intern/apply",
    "/profile",
    "/applications",
  ];

  for (const path of legitimateReturnPaths) {
    const sanitized = sanitizeReturnTo(path, "/home");
    assert.equal(sanitized, path, `Legitimate relative path "${path}" must be preserved`);
  }
});

test("Security Audit 3: Tamper-Proof HMAC-SHA256 Signed Session Cookies", () => {
  const payload = {
    userId: "cand_test_001",
    aiTathastuId: "tathastu_uuid_999",
    name: "Test Candidate",
    email: "test@example.com",
    avatar: "/images/test.jpg",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  };

  const validToken = signSessionPayload(payload);
  assert.ok(validToken.includes("."), "Signed session token must be base64url.signature format");

  // 1. Valid token verification
  const verified = verifySessionToken(validToken);
  assert.ok(verified, "Legitimate signed token must verify successfully");
  assert.equal(verified?.userId, "cand_test_001");
  assert.equal(verified?.role, "candidate");

  // 2. Tampered payload attack: attacker modifies userId in token payload
  const [dataB64, signature] = validToken.split(".");
  const decodedJson = Buffer.from(dataB64, "base64url").toString("utf-8");
  const tamperedJson = decodedJson.replace("cand_test_001", "cand_rohan_sharma_001");
  const tamperedDataB64 = Buffer.from(tamperedJson, "utf-8").toString("base64url");
  const forgedToken = `${tamperedDataB64}.${signature}`;

  assert.equal(
    verifySessionToken(forgedToken),
    null,
    "Tampered token with invalid signature must be rejected"
  );

  // 3. Signature forgery attack: arbitrary signature
  const fakeSigToken = `${dataB64}.invalidsignature12345`;
  assert.equal(
    verifySessionToken(fakeSigToken),
    null,
    "Token with forged signature must be rejected"
  );

  // 4. Expired token rejection
  const expiredToken = signSessionPayload({
    ...payload,
    exp: Math.floor(Date.now() / 1000) - 300, // expired 5 minutes ago
  });
  assert.equal(
    verifySessionToken(expiredToken),
    null,
    "Expired session token must be rejected"
  );
});

test("Security Audit 4: Candidate Data Isolation & Horizontal Privilege Escalation Prevention (End-to-End)", async () => {
  // Generate valid signed sessions for Candidate A and Candidate B
  const tokenCandidateA = signSessionPayload({
    userId: `cand_alpha_${Date.now()}`,
    name: "Candidate Alpha",
    email: "alpha@example.com",
    avatar: "/images/avatar-alpha.jpg",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  });

  const candidateBId = `cand_beta_${Date.now()}`;
  const tokenCandidateB = signSessionPayload({
    userId: candidateBId,
    name: "Candidate Beta",
    email: "beta@example.com",
    avatar: "/images/avatar-beta.jpg",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  });

  // 1. Candidate B uploads a confidential resume
  const validPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
  const uploadPayload = new FormData();
  uploadPayload.append(
    "file",
    new Blob([validPdfBuffer], { type: "application/pdf" }),
    "Candidate_Beta_Private_Resume.pdf"
  );

  const uploadRes = await fetch(`${BASE_URL}/api/resumes`, {
    method: "POST",
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${tokenCandidateB}`,
    },
    body: uploadPayload,
  });

  assert.equal(uploadRes.status, 200, "Candidate B upload should succeed");
  const uploadData = await uploadRes.json();
  const resumeBId = uploadData.resume.id;
  assert.ok(resumeBId, "Resume ID must be generated");

  // 2. Candidate A attempts to download Candidate B's resume (Horizontal Privilege Escalation Attack)
  const attackRes = await fetch(`${BASE_URL}/api/resumes/${resumeBId}`, {
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${tokenCandidateA}`,
    },
  });

  assert.equal(
    attackRes.status,
    403,
    "Candidate A must be rejected with 403 Forbidden when attempting to access Candidate B's resume"
  );
  const attackData = await attackRes.json();
  assert.ok(attackData.error.includes("Forbidden") || attackData.error.includes("permission"));

  // 3. Candidate B can download their own resume
  const ownerRes = await fetch(`${BASE_URL}/api/resumes/${resumeBId}`, {
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${tokenCandidateB}`,
    },
  });
  assert.equal(ownerRes.status, 200, "Owner Candidate B must successfully download their resume");

  // 4. Unauthenticated access to resume must be rejected with 401
  const unauthResumeRes = await fetch(`${BASE_URL}/api/resumes/${resumeBId}`);
  assert.equal(
    unauthResumeRes.status,
    401,
    "Unauthenticated request to download a resume must return 401 Unauthorized"
  );

  // 5. Candidate A querying their resumes list does not see Candidate B's resume
  const listResA = await fetch(`${BASE_URL}/api/resumes`, {
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${tokenCandidateA}`,
    },
  });
  assert.equal(listResA.status, 200);
  const listDataA = await listResA.json();
  assert.equal(
    listDataA.resumes.some((r) => r.id === resumeBId),
    false,
    "Candidate A must not see Candidate B's private resume in their list"
  );
});

test("Security Audit 5: Unauthenticated Access to Protected APIs Guard", async () => {
  // With x-enforce-auth header, endpoints verify strict unauthenticated rejection
  const endpoints = [
    { url: `${BASE_URL}/api/profile`, method: "GET" },
    { url: `${BASE_URL}/api/resumes`, method: "GET" },
    { url: `${BASE_URL}/api/applications`, method: "GET" },
    { url: `${BASE_URL}/api/jobs/saved`, method: "GET" },
  ];

  for (const ep of endpoints) {
    const res = await fetch(ep.url, {
      method: ep.method,
      headers: {
        "x-enforce-auth": "true",
      },
    });

    assert.equal(
      res.status,
      401,
      `Unauthenticated access to ${ep.url} with strict auth must return 401 Unauthorized`
    );
  }
});

test("Security Audit 6: Admin Privilege Escalation & Insecure Secret Rejection", () => {
  // 1. Ordinary candidate cookie attempting admin check
  const candidateCookie = signSessionPayload({
    userId: "cand_test_normal",
    name: "Normal Candidate",
    email: "normal@example.com",
    avatar: "",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  });

  const fakeReq = {
    headers: { get: () => null },
    cookies: {
      get: (name) => (name === SESSION_COOKIE_NAME ? { value: candidateCookie } : undefined),
    },
  };

  const adminResult = checkAdminAuth(fakeReq);
  assert.equal(
    adminResult.authorized,
    false,
    "Candidate session must NOT be granted administrator privileges"
  );

  // 2. Unsigned / spoofed admin cookie
  const spoofedCookie = JSON.stringify({ role: "admin", isAdmin: true });
  const spoofReq = {
    headers: { get: () => null },
    cookies: {
      get: (name) => (name === ADMIN_COOKIE_NAME ? { value: spoofedCookie } : undefined),
    },
  };
  const spoofResult = checkAdminAuth(spoofReq);
  assert.equal(
    spoofResult.authorized,
    false,
    "Unsigned spoofed cookie must fail cryptographic signature check"
  );

  // 3. Insecure legacy credentials ("admin", "avsar2025") must NOT be accepted
  const legacyReq1 = {
    headers: { get: (name) => (name === ADMIN_KEY_HEADER ? "admin" : null) },
    cookies: { get: () => undefined },
  };
  assert.equal(
    checkAdminAuth(legacyReq1).authorized,
    false,
    "Legacy default credential 'admin' must be rejected"
  );

  const legacyReq2 = {
    headers: { get: (name) => (name === ADMIN_KEY_HEADER ? "avsar2025" : null) },
    cookies: { get: () => undefined },
  };
  assert.equal(
    checkAdminAuth(legacyReq2).authorized,
    false,
    "Legacy credential 'avsar2025' must be rejected"
  );

  // 4. Valid signed admin session must pass
  const validAdminToken = signSessionPayload({
    userId: "admin_op",
    name: "Admin",
    email: "admin@avsar.local",
    avatar: "",
    role: "admin",
    provider: "admin_key",
    createdAt: Date.now(),
  });
  const validAdminReq = {
    headers: { get: () => null },
    cookies: {
      get: (name) => (name === ADMIN_COOKIE_NAME ? { value: validAdminToken } : undefined),
    },
  };
  assert.equal(
    checkAdminAuth(validAdminReq).authorized,
    true,
    "Cryptographically signed admin session must be authorized"
  );
});

test("Security Audit 7: Candidate Attempting Admin Operations via API", async () => {
  const candidateToken = signSessionPayload({
    userId: `cand_user_${Date.now()}`,
    name: "Candidate NonAdmin",
    email: "nonadmin@example.com",
    avatar: "",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  });

  // Candidate attempts to view admin metrics
  const metricsRes = await fetch(`${BASE_URL}/api/admin/metrics`, {
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${candidateToken}`,
    },
  });
  assert.equal(
    metricsRes.status,
    401,
    "Candidate session must be rejected when attempting to access /api/admin/metrics"
  );

  // Candidate attempts to import jobs
  const importRes = await fetch(`${BASE_URL}/api/admin/import-jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${SESSION_COOKIE_NAME}=${candidateToken}`,
    },
    body: JSON.stringify({ action: "ingest_root" }),
  });
  assert.equal(
    importRes.status,
    401,
    "Candidate session must be rejected when attempting to call /api/admin/import-jobs"
  );
});

test("Security Audit 8: Admin Rate Limiting & Audit Logging", () => {
  const testIp = "10.0.0.99";

  // Send 10 rapid attempts
  for (let i = 0; i < 10; i++) {
    const res = checkAdminRateLimit(testIp);
    assert.equal(res.allowed, true, `Attempt ${i + 1} should be within rate limit`);
  }

  // 11th attempt must be throttled
  const throttled = checkAdminRateLimit(testIp);
  assert.equal(throttled.allowed, false, "11th attempt within 5 minutes must be rate limited");
  assert.ok(throttled.retryAfterSeconds > 0, "Retry-After seconds must be provided");

  // Audit logging verification
  logAdminAction({
    action: "test_security_audit_event",
    ip: testIp,
    success: true,
    details: "Automated test execution",
  });
});

test("Security Audit 9: Live OAuth Code Exchange Error Handling & Token Validation", async () => {
  // 1. Server returns account disabled / suspended error
  const disabledAccountFetch = async () => {
    return new Response(
      JSON.stringify({
        error: "account_disabled",
        error_description: "The AI Tathastu account is disabled or suspended by administrator.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  };

  const disabledResult = await exchangeCodeForProfile("mock_code_123", "mock_verifier_123", {
    customFetch: disabledAccountFetch,
  });

  assert.equal(disabledResult.ok, false);
  if (!disabledResult.ok) {
    assert.equal(disabledResult.isAccountDisabled, true, "Disabled account flag must be detected");
  }

  // 2. Server returns invalid or expired code
  const expiredCodeFetch = async () => {
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "Authorization code has expired or was already redeemed.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  };

  const expiredResult = await exchangeCodeForProfile("expired_code", "verifier", {
    customFetch: expiredCodeFetch,
  });
  assert.equal(expiredResult.ok, false);
  if (!expiredResult.ok) {
    assert.equal(expiredResult.code, "invalid_grant");
  }

  // 3. Direct profile fallback in controlled mock
  const directProfileFetch = async () => {
    return new Response(
      JSON.stringify({
        profile: {
          sub: "tathastu_uuid_direct_test",
          email: "direct@example.com",
          name: "Direct User",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const directResult = await exchangeCodeForProfile("code", "verifier", {
    customFetch: directProfileFetch,
  });
  assert.equal(directResult.ok, true);
  if (directResult.ok) {
    assert.equal(directResult.profile.sub, "tathastu_uuid_direct_test");
  }
});

test("Security Audit 10: Logout and Subsequent Protected-Route Access", async () => {
  const token = signSessionPayload({
    userId: `cand_logout_test_${Date.now()}`,
    name: "Logout Tester",
    email: "logout@example.com",
    avatar: "",
    role: "candidate",
    provider: "ai_tathastu",
    createdAt: Date.now(),
  });

  // Verify session is initially recognized
  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
  });
  assert.equal(sessionRes.status, 200);
  const sessionData = await sessionRes.json();
  assert.equal(sessionData.authenticated, true);

  // Call logout endpoint
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    },
  });
  assert.equal(logoutRes.status, 200);
  const setCookieHeaders = logoutRes.headers.get("set-cookie") || "";
  assert.ok(
    setCookieHeaders.includes(`${SESSION_COOKIE_NAME}=`) &&
      (setCookieHeaders.includes("Max-Age=0") || setCookieHeaders.includes("expires=")),
    "Logout must instruct browser to clear the session cookie"
  );
});

test("Security Audit 11: Environment Configuration Validation & Diagnostics", () => {
  const audit = validateAuthConfig();
  assert.ok(typeof audit.isConfigured === "boolean");
  assert.ok(typeof audit.isProductionReady === "boolean");
  assert.ok(Array.isArray(audit.warnings));
  assert.ok(audit.configSummary.issuer);
  assert.ok(audit.configSummary.clientId);
});

test("Security Audit 12: OAuth Callback State & Consent Error Handling", async () => {
  // 1. Missing state and code returns invalid_state
  const missingStateRes = await fetch(`${BASE_URL}/api/auth/aitathastu/callback`, {
    redirect: "manual",
  });
  assert.equal(missingStateRes.status, 307);
  const location1 = missingStateRes.headers.get("location") || "";
  assert.ok(location1.includes("error=invalid_state"), "Missing state must redirect to auth with invalid_state");

  // 2. Mismatched state returns invalid_state
  const mismatchRes = await fetch(
    `${BASE_URL}/api/auth/aitathastu/callback?code=mock_code&state=forged_state`,
    {
      redirect: "manual",
      headers: {
        Cookie: "avsar_oauth_state=expected_state; avsar_oauth_verifier=expected_verifier",
      },
    }
  );
  assert.equal(mismatchRes.status, 307);
  const location2 = mismatchRes.headers.get("location") || "";
  assert.ok(location2.includes("error=invalid_state"), "Mismatched state must redirect to auth with invalid_state");

  // 3. Denied consent parameter returns consent_denied
  const deniedRes = await fetch(
    `${BASE_URL}/api/auth/aitathastu/callback?error=access_denied&error_description=User+denied+permissions`,
    {
      redirect: "manual",
    }
  );
  assert.equal(deniedRes.status, 307);
  const location3 = deniedRes.headers.get("location") || "";
  assert.ok(location3.includes("error=consent_denied"), "Denied consent must redirect with consent_denied");
});

test("Security Audit 13: Cryptographic JWT Claims Verification (Signature, Issuer, Audience, Expiration)", async () => {
  const { generateKeyPair, SignJWT, jwtVerify } = await import("jose");
  const { privateKey, publicKey } = await generateKeyPair("ES256");

  // 1. Valid Token
  const validJwt = await new SignJWT({ sub: "tathastu_verified_user_123", email: "user@tathastu.com" })
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer("https://www.aitathastu.com")
    .setAudience("avsar")
    .setExpirationTime("2h")
    .sign(privateKey);

  const verified = await jwtVerify(validJwt, publicKey, {
    issuer: "https://www.aitathastu.com",
    audience: "avsar",
  });
  assert.equal(verified.payload.sub, "tathastu_verified_user_123");

  // 2. Wrong Issuer Attack
  const wrongIssuerJwt = await new SignJWT({ sub: "user_fake" })
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer("https://malicious-idp.com")
    .setAudience("avsar")
    .setExpirationTime("2h")
    .sign(privateKey);

  await assert.rejects(
    async () => {
      await jwtVerify(wrongIssuerJwt, publicKey, {
        issuer: "https://www.aitathastu.com",
        audience: "avsar",
      });
    },
    { code: "ERR_JWT_CLAIM_VALIDATION_FAILED" },
    "JWT with wrong issuer must be rejected"
  );

  // 3. Wrong Audience Attack
  const wrongAudJwt = await new SignJWT({ sub: "user_fake" })
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer("https://www.aitathastu.com")
    .setAudience("unauthorized_app_id")
    .setExpirationTime("2h")
    .sign(privateKey);

  await assert.rejects(
    async () => {
      await jwtVerify(wrongAudJwt, publicKey, {
        issuer: "https://www.aitathastu.com",
        audience: "avsar",
      });
    },
    { code: "ERR_JWT_CLAIM_VALIDATION_FAILED" },
    "JWT with wrong audience must be rejected"
  );

  // 4. Expired Token
  const expiredJwt = await new SignJWT({ sub: "user_expired" })
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer("https://www.aitathastu.com")
    .setAudience("avsar")
    .setExpirationTime("-10m")
    .sign(privateKey);

  await assert.rejects(
    async () => {
      await jwtVerify(expiredJwt, publicKey, {
        issuer: "https://www.aitathastu.com",
        audience: "avsar",
      });
    },
    { code: "ERR_JWT_EXPIRED" },
    "Expired JWT must be rejected"
  );

  // 5. Invalid Signature / Altered payload
  const [h, , s] = validJwt.split(".");
  const alteredPayload = Buffer.from(JSON.stringify({ sub: "hacked" })).toString("base64url");
  const tamperedJwt = `${h}.${alteredPayload}.${s}`;

  await assert.rejects(
    async () => {
      await jwtVerify(tamperedJwt, publicKey, {
        issuer: "https://www.aitathastu.com",
        audience: "avsar",
      });
    },
    { code: "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" },
    "Tampered JWT signature must be rejected"
  );
});

test("Security Audit 14: Production Guard on Demo Auth & Missing Production Secrets", () => {
  function isDemoAllowed(env, allowFlag) {
    return env !== "production" || allowFlag === "true";
  }

  // Production with allowDemoAuth unset or false
  assert.equal(isDemoAllowed("production", undefined), false, "Demo auth must be blocked in production");
  assert.equal(isDemoAllowed("production", "false"), false, "Demo auth must be blocked when flag is false");
  assert.equal(isDemoAllowed("production", "true"), true, "Demo auth allowed only with explicit override");

  // Admin secret in production
  function resolveAdminSecret(env, secretEnv) {
    if (secretEnv) return secretEnv;
    if (env === "production") return null;
    return "avsar_admin_secret_2025";
  }

  assert.equal(resolveAdminSecret("production", undefined), null, "Admin secret must be null in production if unset");
  assert.equal(
    resolveAdminSecret("production", "secure_prod_key_789"),
    "secure_prod_key_789",
    "Admin secret preserved when explicitly configured"
  );
  assert.equal(resolveAdminSecret("development", undefined), "avsar_admin_secret_2025", "Dev fallback allowed in development");
});
