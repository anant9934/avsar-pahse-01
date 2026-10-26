# Avsar Production Defect Register

> **Repository:** [https://github.com/anant9934/avsar-pahse-01.git](https://github.com/anant9934/avsar-pahse-01.git)  
> **Target Branch:** `main`  
> **Author:** Anant Kumar (`anant9934@users.noreply.github.com`)  
> **Status:** Active Production Quality Assurance  
> **Prioritization Schema:**  
> - **P0 — Critical:** Direct data corruption, complete authentication bypass, or system-wide denial of service.  
> - **P1 — High:** Cross-user data leakage, stored/reflected security vulnerabilities, or broken core user journeys.  
> - **P2 — Medium:** Data integrity edge cases, orphan foreign records, or misleading UI state.  
> - **P3 — Low:** Cosmetic anomalies, minor accessibility warnings, or non-blocking layout discrepancies.

---

## Defect Inventory

| ID | Severity | Category | Affected File(s) | Summary | Status | Commit SHA |
|---|---|---|---|---|---|---|
| `DEFECT-AUTH-01` | **P1** | Authorization | `src/app/api/jobs/[id]/route.ts` | Single job API hardcodes Rohan Sharma for match score and bookmark resolution | **RESOLVED** | `1c7ce40`, `5353b9d` |
| `DEFECT-AUTH-02` | **P1** | Authorization | `src/app/jobs/[id]/page.tsx` | SSR job detail page pre-renders match and bookmark state using hardcoded candidate | **RESOLVED** | `627ddfd` |
| `DEFECT-AUTH-03` | **P1** | Authorization | `src/app/jobs/[id]/match/page.tsx` | SSR match breakdown pre-renders analysis against hardcoded candidate | **RESOLVED** | `faaca5c` |
| `DEFECT-SEC-01` | **P1** | Security / XSS | `src/lib/auth/url-sanitizer.ts`, `src/lib/jobs/normalization.ts` | External application links accept dangerous schemes (`javascript:`, `data:`) | **RESOLVED** | `2077c4a`, `00fcf5c`, `e8652af`, `349ff0e` |
| `DEFECT-APP-01` | **P2** | Data Integrity | `src/app/api/applications/route.ts` | Non-existent resume ID is accepted when submitting an application | **RESOLVED** | `559939d`, `19477c9` |
| `DEFECT-UI-01` | **P2** | User Experience | `src/app/jobs/[id]/apply/page.tsx` | Application form pre-fills Rohan Sharma's portfolio URL and pitch | **RESOLVED** | `19574f0` |

---

## Detailed Defect Records

### `DEFECT-AUTH-01`: Single Job API Hardcodes Rohan Sharma for Match & Saved Status
- **Severity:** P1 (High)
- **Category:** Candidate Identity & Authorization
- **Affected File:** `src/app/api/jobs/[id]/route.ts` (lines 21–23)
- **Workflow:** Job discovery, candidate personalized match score, and saved status in single job retrieval.
- **Reproduction Steps:**
  1. Authenticate as Candidate B (e.g., `cand_priya_patel_002` or an AI Tathastu SSO authenticated session).
  2. Send a `GET /api/jobs/job_google_fe_intern` request with candidate B's session cookie.
  3. Inspect the response payload: `match` is computed against Rohan Sharma's skills (92%), and `isSaved` reflects Rohan Sharma's bookmarks rather than Candidate B's actual profile and bookmarks.
- **Root Cause:**
  `src/app/api/jobs/[id]/route.ts` invokes `candRepo.getById("cand_rohan_sharma_001")` directly without calling `getAuthenticatedCandidate(request)` to extract the candidate ID from the incoming session.
- **Proposed Fix:**
  Use `getAuthenticatedCandidate(request)` to resolve the active session's candidate ID. Calculate `calculateJobMatch` and `savedRepo.isSaved` for the authenticated candidate, with safe fallback to default demo candidate when unauthenticated.
- **Regression Test:** `test/job-detail-authenticated.test.mjs`
- **Acceptance Criteria:**
  - Authenticated candidate receives match score calculated from their own profile skills.
  - `isSaved` returns `true` only if the active authenticated candidate has bookmarked the job.
  - Unauthenticated requests safely receive general match data without throwing runtime exceptions.

---

### `DEFECT-AUTH-02`: SSR Job Detail Page Pre-renders Hardcoded Candidate
- **Severity:** P1 (High)
- **Category:** Candidate Identity & Authorization
- **Affected File:** `src/app/jobs/[id]/page.tsx` (lines 23–25)
- **Workflow:** Server-side pre-rendering of job details.
- **Reproduction Steps:**
  1. Log in with an authenticated candidate session.
  2. Perform an initial server navigation to `/jobs/job_google_fe_intern`.
  3. Inspect the initial SSR HTML payload rendered before client hydration: match badge and bookmark state reflect `cand_rohan_sharma_001`.
- **Root Cause:**
  The async Server Component accesses `candRepo.getById("cand_rohan_sharma_001")` without reading cookies via `await cookies()` and verifying the session token.
- **Proposed Fix:**
  Read `await cookies()`, extract `SESSION_COOKIE_NAME`, verify via `verifySessionToken`, and resolve candidate ID dynamically for server-side pre-rendering.
- **Regression Test:** Component & SSR integration tests.
- **Acceptance Criteria:**
  - Pre-rendered HTML matches the authenticated candidate's profile and bookmarks, eliminating hydration jumps.

---

### `DEFECT-AUTH-03`: SSR Match Breakdown Page Pre-renders Hardcoded Candidate
- **Severity:** P1 (High)
- **Category:** Candidate Identity & Authorization
- **Affected File:** `src/app/jobs/[id]/match/page.tsx` (lines 22–24)
- **Workflow:** Server-side pre-rendering of match breakdown and ERIS score explanation.
- **Reproduction Steps:**
  1. Navigate to `/jobs/job_google_fe_intern/match` while logged in as a candidate with a distinct skill set.
  2. Inspect the pre-rendered score breakdown: it evaluates Rohan Sharma's skill set instead of the active candidate.
- **Root Cause:**
  Server Component pre-fetches `cand_rohan_sharma_001` directly without session cookie resolution.
- **Proposed Fix:**
  Read `await cookies()`, extract session token, and dynamically load the authenticated candidate's profile.
- **Regression Test:** Component & SSR verification.
- **Acceptance Criteria:**
  - Pre-rendered match breakdown accurately compares the job requirements against the authenticated candidate's skills.

---

### `DEFECT-SEC-01`: External Application Links Accept Dangerous URL Schemes (XSS / Injection)
- **Severity:** P1 (High)
- **Category:** Security / Input Validation / Protocol Sanitization
- **Affected Files:** `src/lib/auth/url-sanitizer.ts`, `src/lib/jobs/normalization.ts`, `src/app/jobs/[id]/JobDetailClient.tsx`
- **Workflow:** External job link normalization, storage, and outbound navigation dialog.
- **Reproduction Steps:**
  1. Ingest a job record containing `"apply_url": "javascript:alert(document.cookie)"` or `"data:text/html,<script>alert(1)</script>"`.
  2. Open the job details page and click "Apply on Company Site".
  3. Click "Continue" in the external application confirmation modal.
  4. The browser executes the malicious JavaScript scheme in the context of `avsar.app`.
- **Root Cause:**
  `src/lib/jobs/normalization.ts` accepts any non-empty string in `raw.apply_url` without protocol scheme validation. `JobDetailClient.tsx` renders `<a href={job.applyUrl} target="_blank">` directly.
- **Proposed Fix:**
  1. Create `src/lib/auth/url-sanitizer.ts` exporting `sanitizeExternalUrl()`.
  2. Validate that URL protocol is strictly `https:`, `http:`, or `mailto:`.
  3. Reject `javascript:`, `data:`, `vbscript:`, and unparseable strings by returning `null`.
  4. Apply sanitization in `normalization.ts` and provide safe fallback in UI.
- **Regression Test:** `test/unit/url-sanitizer.test.mjs`
- **Acceptance Criteria:**
  - `sanitizeExternalUrl` strips all non-whitelisted protocols.
  - Normalization excludes dangerous links, preventing stored XSS.
  - UI never renders executable script links.

---

### `DEFECT-APP-01`: Non-Existent Resume ID Accepted in Application Submission
- **Severity:** P2 (Medium)
- **Category:** Data Integrity & Validation
- **Affected File:** `src/app/api/applications/route.ts` (lines 63–72)
- **Workflow:** Candidate application submission with resume attachment.
- **Reproduction Steps:**
  1. Submit a `POST /api/applications` with valid `jobId` and an invalid `resumeId: "res_nonexistent_999"`.
  2. Observe that the API accepts the submission (HTTP 200/201) and creates an application record referencing a non-existent resume.
- **Root Cause:**
  `src/app/api/applications/route.ts` checks `if (targetResume && targetResume.candidateId !== auth.candidateId)`. When `targetResume` is `null`, this condition is false, allowing execution to proceed without asserting resume existence.
- **Proposed Fix:**
  If `resumeId` is provided, require `targetResume` to exist. If not found, respond with `404 Not Found` (`Resume "${resumeId}" was not found.`).
- **Regression Test:** `test/application-validation.test.mjs`
- **Acceptance Criteria:**
  - Non-existent resume ID yields HTTP 404.
  - Foreign resume ID yields HTTP 403.
  - Valid resume ID owned by candidate yields HTTP 200.

---

### `DEFECT-UI-01`: Application Form Pre-fills Rohan Sharma's Portfolio and Pitch
- **Severity:** P2 (Medium)
- **Category:** User Experience & Candidate Identity Leakage
- **Affected File:** `src/app/jobs/[id]/apply/page.tsx` (lines 38–43, 63–66)
- **Workflow:** Candidate application questionnaire form.
- **Reproduction Steps:**
  1. Log in as a newly created candidate (or any candidate other than Rohan).
  2. Navigate to `/jobs/job_google_fe_intern/apply`.
  3. Step 2 (Additional Questions) displays prefilled inputs with `"https://rohan-portfolio.example.com"` and Rohan's pitch notes.
- **Root Cause:**
  React state was statically initialized with Rohan Sharma's portfolio URL and pitch instead of being empty or dynamically loaded from `candidate.portfolio`.
- **Proposed Fix:**
  Initialize `portfolioUrl` to empty string. When profile data loads, set `portfolioUrl` from `candidate.portfolio || ""`. Initialize `experienceNotes` to empty string with helpful placeholder text.
- **Regression Test:** Visual and automated form state validation.
- **Acceptance Criteria:**
  - Form fields reflect the authenticated candidate's data without hardcoded seed strings.

---

### `DEFECT-SERVERLESS-01`: Ephemeral Local Storage Fallback in Production Causes Document Loss
- **Severity:** P0 (Critical)
- **Category:** Data Durability & Serverless Reliability
- **Affected File:** `src/lib/storage/index.ts`
- **Workflow:** Candidate resume upload in serverless container environment.
- **Root Cause:**
  When cloud object storage environment variables (`STORAGE_BUCKET`) were omitted in production, the factory silently fell back to `LocalStorageProvider`, writing files to the container's ephemeral filesystem, resulting in permanent file loss upon lambda termination.
- **Resolution:**
  Enforced strict check: in production (`NODE_ENV=production`), `getStorageProvider()` rejects ephemeral local storage with an informative configuration error unless explicitly overridden with `ALLOW_EPHEMERAL_LOCAL_STORAGE=true`.
- **Regression Test:** `test/vercel-deployment.test.mjs` (Test 2)
- **Status:** **RESOLVED** (`0c2fb24`)

---

### `DEFECT-API-03`: Missing Authenticated Resume Deletion Endpoint with Cloud Object Cleanup
- **Severity:** P1 (High)
- **Category:** API Completeness & Storage Lifecycle Management
- **Affected File:** `src/app/api/resumes/[id]/route.ts`
- **Workflow:** Candidate managing or removing outdated resumes from profile.
- **Root Cause:**
  `src/app/api/resumes/[id]/route.ts` only implemented `GET`. There was no `DELETE` method, making it impossible for candidates to delete uploaded documents and creating stranded S3 storage costs.
- **Resolution:**
  Implemented authenticated `DELETE` handler with candidate ownership enforcement, horizontal privilege escalation defense, durable object storage deletion (`storage.delete`), local file cleanup, and database record removal.
- **Regression Test:** `test/api.test.mjs` & `test/vercel-deployment.test.mjs`
- **Status:** **RESOLVED** (`045d066`)

---

### `DEFECT-DEPLOY-01`: Static Redirect URI Misconfiguration on Vercel Environments
- **Severity:** P1 (High)
- **Category:** Authentication & Domain Configuration
- **Affected File:** `src/lib/auth/aitathastu.ts`
- **Workflow:** User authentication via AI Tathastu SSO on deployed Vercel previews and production domains.
- **Root Cause:**
  `AUTH_CONFIG.redirectUri` was statically initialized to `http://localhost:3000/...` at module load time when `AVSAR_AUTH_REDIRECT_URI` was omitted, breaking OAuth on preview and production URLs.
- **Resolution:**
  Implemented dynamic base URL resolution with a getter that inspects `NEXT_PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, and `VERCEL_URL` dynamically.
- **Regression Test:** `test/vercel-deployment.test.mjs` (Test 1)
- **Status:** **RESOLVED** (`78886bb`)

---

### `DEFECT-SEC-04`: Missing Production Security Headers and Server Framework Fingerprinting
- **Severity:** P2 (Medium)
- **Category:** Application Security & Hardening
- **Affected File:** `next.config.ts`
- **Workflow:** Global HTTP response headers across all website routes.
- **Root Cause:**
  Next.js default configuration emitted the `X-Powered-By: Next.js` header and lacked defense-in-depth security headers (`X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, `Permissions-Policy`).
- **Resolution:**
  Configured `poweredByHeader: false`, enabled `compress: true`, and injected strict security headers on all routes (`/(.*)`).
- **Regression Test:** `test/vercel-deployment.test.mjs` (Test 5)
- **Status:** **RESOLVED** (`2701c2d`)

