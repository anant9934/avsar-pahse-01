# AVSAR PLATFORM — STRIDE THREAT MODEL & SECURITY ARCHITECTURE

**System:** Avsar Recruitment Platform (Next.js 16, Neon Serverless PostgreSQL, Upstash Redis, S3-Compatible Storage)  
**Governance:** AI Tathastu Production Assurance (Phase 8)  
**Classification:** Enterprise Internal Security Standard

---

## 1. THREAT ACTORS & ATTACK SURFACE PROFILES

| Actor Profile | Description | Motive / Vector | Target Assets | Mitigations |
|---|---|---|---|---|
| **1. Anonymous Public User** | Unauthenticated web visitor browsing jobs | Scraping, credential stuffing, DDoS | Public jobs API, search routes, SSR functions | Edge rate limits, CDN caching, Cloudflare proxy, ETag conditional requests |
| **2. Authenticated Candidate** | Registered student with verified session token | Horizontal privilege escalation (BOLA/IDOR), resume tampering | Other candidates' applications, resumes, profiles | Server-side session verification, foreign key cascades, tenant ownership checks |
| **3. Administrative User** | Privileged recruitment operator or superadmin | Insider misuse, token theft, accidental data destruction | Job catalog, candidate registry, metrics, audit logs | Constant-time password comparison (`safeCompare`), HttpOnly SameSite cookies, immutable audit logging |
| **4. Malicious Job Poster / Ingestion** | Untrusted external platform or syndication feed | Stored XSS, phishing links, misleading compensation | Job listings, candidate apply redirection | HTML tag stripping, URL schema sanitizer (rejecting `javascript:`, `data:`), CTC normalization |
| **5. Abusive Client / Bot** | Automated scraper or rapid-fire application submitter | Resource exhaustion, race condition exploitation | Application endpoints, search endpoints | Sliding-window atomic rate limiting, Idempotency keys, CAPTCHA integration ready |
| **6. Compromised Integration** | Rogue OAuth callback or corrupted SSO provider | Account takeover, identity spoofing | External identity mapping table | Strict redirect URI allowlist, PKCE code verifier, HMAC signature validation |
| **7. Malicious Upload Document** | Candidate submitting weaponized PDF/DOCX | Remote code execution, serverless worker compromise, parser exploits | Resume storage bucket, parser workers | Magic byte signature verification (`validateDocumentMagicBytes`), 5MB size limit, private storage |
| **8. Misconfigured Deployment** | Ephemeral storage in production, leaked env vars | Data loss, credential exposure in build logs | Database connection strings, API tokens | Startup environment validation, secret masking, Vercel production check |
| **9. Provider Outage** | Neon database transient glitch, Upstash network partition | System cascading failure, data corruption | ACID state integrity, background tasks | Neon circuit breaker, retry with exponential backoff & jitter, durable outbox |

---

## 2. TRUST BOUNDARIES & ASSET MAP

```
+-------------------------------------------------------------------------------+
| UNTRUSTED EXTERNAL ZONE                                                       |
|   - Web Browsers & Mobile Clients                                            |
|   - Scrapers, Crawlers, Third-party APIs                                      |
+-------------------------------------------------------------------------------+
                                      |
                        HTTPS (TLS 1.3) / Strict-Transport-Security
                                      v
+-------------------------------------------------------------------------------+
| PERIMETER / EDGE BOUNDARY                                                     |
|   - Vercel Edge Network / Cloudflare Proxy                                    |
|   - Rate Limiting (Sliding Window: IP / Candidate Subject)                    |
|   - RFC 7232 ETag Validation (304 Not Modified)                                |
+-------------------------------------------------------------------------------+
                                      |
                        Internal Vercel Function Runtime
                                      v
+-------------------------------------------------------------------------------+
| APPLICATION LOGIC BOUNDARY                                                    |
|   - Server Session Extraction & HMAC Token Verification                      |
|   - Idempotency Interceptor (Deduplication & Replay)                          |
|   - Input Sanitization (Magic Bytes, URL Allowlist, Canonical JSON)           |
+-------------------------------------------------------------------------------+
       |                                      |                         |
  TLS  |                                 TLS  |                    TLS  |
       v                                      v                         v
+-----------------------+     +-----------------------+     +-------------------+
| NEON POSTGRESQL (ACID)|     | UPSTASH REDIS (CACHE) |     | OBJECT STORAGE    |
| - Parameterized SQL   |     | - Scoped Keys (v1)    |     | - Private Bucket  |
| - Unique Constraints  |     | - Tag Invalidation    |     | - Signed URLs     |
| - SKIP LOCKED Queue   |     | - Singleflight Stampede|    | - No Public Links |
+-----------------------+     +-----------------------+     +-------------------+
```

---

## 3. STRIDE THREAT MATRIX & VERIFIED MITIGATIONS

### S — Spoofing Identity
- **Threat:** Client passes arbitrary `candidateId` in JSON payload to access or submit another candidate's application.
- **Mitigation:** Authenticated session identity (`auth.candidateId`) resolved strictly on server from signed cookie payload; client payload IDs are completely discarded.
- **Threat:** Attacker spoofs `X-Forwarded-For` header to bypass IP rate limits or impersonate campus NAT.
- **Mitigation:** `extractVerifiedClientIp` prioritizes tamper-proof edge platform headers (`x-vercel-forwarded-for`, `cf-connecting-ip`).

### T — Tampering With Data
- **Threat:** Malicious executable renamed to `.pdf` uploaded to compromise backend processing.
- **Mitigation:** `validateDocumentMagicBytes` reads binary buffer header and rejects any file lacking genuine `%PDF-` or PK ZIP signatures.
- **Threat:** Submitting concurrent duplicate applications to trigger double processing.
- **Mitigation:** Database-level composite unique constraint `unique_candidate_job_application` + atomic `withIdempotency` checking.

### R — Repudiation
- **Threat:** Administrator deletes job or modifies applicant status without traceability.
- **Mitigation:** All privileged operations record immutable audit events in `audit_events` table and queue.

### I — Information Disclosure
- **Threat:** Timing attacks on admin secret or session token comparison.
- **Mitigation:** `safeCompare` computes SHA-256 pre-hashes to guarantee constant-time comparison on fixed 32-byte buffers.
- **Threat:** Private candidate resume directly accessible via public permanent URLs.
- **Mitigation:** Object storage buckets are private; downloads require short-lived signed URLs generated dynamically after ownership validation.

### D — Denial of Service
- **Threat:** Cache stampede / thundering herd when a popular job posting expires.
- **Mitigation:** Singleflight promise coalescing in `MemoryCacheProvider` and `RedisCacheProvider` ensures only 1 upstream query executes.
- **Threat:** Database connection exhaustion under 1,000 concurrent users.
- **Mitigation:** Neon PgBouncer connection pooling enabled; circuit breaker `neon_db` limits queued callers.

### E — Elevation of Privilege
- **Threat:** Candidate accesses admin import or candidate metrics endpoints.
- **Mitigation:** `checkAdminAuth` strictly validates HttpOnly admin session cookie or administrative bearer secret close to endpoint boundary.

---

## 4. RESIDUAL RISKS & ONGOING GOVERNANCE

1. **Third-party SSO Provider Outage:** When external AI Tathastu identity provider is degraded, local sessions remain valid until TTL expiration; offline session refreshing requires manual fallback.
2. **Campus NAT Clumping:** Unauthenticated rate limiting on campus Wi-Fi can still share global IP quota; mitigated by prompt student login which immediately switches rate-limiting to individual `cand:<id>` scope.
