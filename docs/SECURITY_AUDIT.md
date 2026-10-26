# Avsar Security Audit & Defenses

## Overview

Avsar has been audited and hardened according to OWASP Top 10 standards for web applications and API security. This document details the threat model, technical security controls, defense-in-depth layers, and audit logging safeguards.

---

## 1. Threat Model & Mitigations

### A. Broken Object Level Authorization (BOLA / IDOR)
- **Threat**: Malicious candidates accessing other candidates' private resume PDFs or application details by tampering with resource IDs in API parameters.
- **Defense**:
  - In [`src/app/api/resumes/[id]/route.ts`](file:///Users/quantum/Desktop/avsar/src/app/api/resumes/[id]/route.ts), every download or deletion request requires an authenticated session.
  - Candidate ID ownership is strictly verified against the database record (`resume.candidateId === session.candidateId`).
  - Unauthorized access attempts immediately return `403 Forbidden` and trigger a security audit log event with the client's masked IP and session ID.

### B. Unrestricted File Upload & Remote Code Execution (RCE)
- **Threat**: Uploading malicious executable scripts disguised with a `.pdf` file extension.
- **Defense**:
  - **Magic Bytes Inspection**: In [`src/lib/storage/magic-bytes.ts`](file:///Users/quantum/Desktop/avsar/src/lib/storage/magic-bytes.ts), the first 4 bytes of uploaded files are verified:
    - PDF files must begin with `%PDF` (`0x25 0x50 0x44 0x46`).
    - DOCX files must begin with the ZIP magic header `PK\x03\x04` (`0x50 0x4B 0x03 0x04`).
  - **Extension Whitelist**: Only `.pdf` and `.docx` are accepted.
  - **File Size Cap**: Hard limit of 10 MB enforced on streams prior to storage ingestion.
  - **Storage Isolation**: Files are stored with random UUID filenames outside the web server's publicly routable static document root.

### C. Timing Attacks & Token Forgery
- **Threat**: Disclosing cryptographic signatures or state hashes byte-by-byte via timing differences in standard equality (`===`) comparisons.
- **Defense**:
  - In [`src/lib/auth/timing-safe.ts`](file:///Users/quantum/Desktop/avsar/src/lib/auth/timing-safe.ts), all HMAC signature verifications and OAuth state checks use `crypto.timingSafeEqual` with zero-padded byte arrays to prevent timing side channels.

### D. Server-Side Request Forgery (SSRF) & Open Redirects
- **Threat**: Tricking the server into querying internal VPC endpoints or redirecting candidates to phishing portals post-authentication.
- **Defense**:
  - In [`src/lib/auth/url-sanitizer.ts`](file:///Users/quantum/Desktop/avsar/src/lib/auth/url-sanitizer.ts), external application links and OAuth return URLs are filtered:
    - Protocol restricted strictly to `http:` and `https:`.
    - Local loopback (`127.0.0.1`, `localhost`), IPv6 equivalents (`::1`), link-local metadata addresses (`169.254.169.254`), and private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) are strictly rejected in production.

### E. Rate Limiting & Denial of Service (DoS)
- **Threat**: Brute-forcing admin endpoints or spamming application submissions.
- **Defense**:
  - In [`src/lib/auth/rate-limiter.ts`](file:///Users/quantum/Desktop/avsar/src/lib/auth/rate-limiter.ts), token-bucket rate limiting enforces:
    - Sensitive auth routes: Max 20 requests per minute per IP.
    - Application submissions: Max 10 requests per minute per candidate.
    - Standard API reads: Max 120 requests per minute per IP.
  - Standard headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`.

---

## 2. Security Headers & Cookie Policy

All responses set strict HTTP security headers:
- `Content-Security-Policy`: Restricts script, style, and media origins.
- `X-Frame-Options: DENY`: Mitigates clickjacking.
- `X-Content-Type-Options: nosniff`: Prevents MIME type sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin`: Minimizes referrer leakage.
- `Permissions-Policy`: Restricts camera, microphone, and geolocation access.

---

## 3. Audit Logging & Compliance

In [`src/lib/auth/audit-logger.ts`](file:///Users/quantum/Desktop/avsar/src/lib/auth/audit-logger.ts), structured JSON audit logs capture:
- **Timestamp** (ISO-8601 UTC)
- **Event Type** (`AUTH_SUCCESS`, `AUTH_FAILURE`, `BOLA_VIOLATION`, `ADMIN_ACTION`, `RESUME_UPLOAD`)
- **Actor Identity** (Candidate ID or Anonymous)
- **Masked IP Address** (Preserves subnet privacy while maintaining abuse diagnostic utility)
- **Target Resource** (Job ID, Application ID, Resume ID)
