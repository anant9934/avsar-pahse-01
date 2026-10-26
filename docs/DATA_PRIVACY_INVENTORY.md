# AVSAR PLATFORM — DATA PRIVACY INVENTORY & LIFECYCLE GOVERNANCE

**Standard:** Avsar Enterprise Privacy, Data Protection & Resume Security  
**Regulatory Framework:** India Digital Personal Data Protection Act (DPDPA 2023) & Global Best Practices  
**Status:** Active Production Policy

---

## 1. DATA CLASSIFICATION REGISTER

| Data Category | Classification | Description / Fields | Purpose | Retention Schedule | Access Boundary | Deletion / Anonymization |
|---|---|---|---|---|---|---|
| **1. Public Job Catalog** | Public | Title, company, location, requirements, salary, deadline, slug | Public discovery & candidate matching | Retained indefinitely or until marked `is_possibly_closed` | Anonymous & public access | Soft delete via `is_possibly_closed = TRUE` |
| **2. Candidate Profile** | Confidential (PII) | Name, email, phone, location, headline, bio, skills, education, experience, ERIS score | Candidate placement & AI matching | Duration of active candidate registration + 1 year inactivity | Candidate self-service & authorized recruiters | Cascading hard delete upon account closure |
| **3. Resume Documents** | Highly Confidential | Binary PDF/DOCX files stored in private object storage | Recruiter evaluation & application attachments | Retained while candidate profile is active; replaced upon new upload | Accessible only via short-lived signed URLs (15 min) | Secure deletion from object storage and `resumes` table |
| **4. Applications** | Confidential | Candidate ID, Job ID, status, answers, reference number, timestamps | Tracking recruitment progress | 3 years post-application for compliance audits | Candidate (own) and administrative recruiters | Retained with anonymized candidate ID upon account closure |
| **5. Session / Auth Tokens** | Secret | Cookie token, HMAC signatures, PKCE code verifier, AI Tathastu UUID | Authentication & authorization | 7 days sliding expiration or explicit logout | Application server runtime only (HttpOnly, Secure) | Immediate revocation on logout |
| **6. Audit Records** | System Confidential | Actor type, actor ID, action, resource type, IP address, timestamp | Security auditing & incident investigation | 365 days rolling retention in `audit_events` | Authorized security operators & compliance leads | Automated pruning after retention expiry |
| **7. Operational Telemetry** | Internal Diagnostic | Correlation ID, HTTP route, status, latency percentiles, DB spans | SRE monitoring & SLO verification | 30 days rolling metric window | System dashboards & Prometheus/Datadog | Auto-purged; zero PII logged |

---

## 2. RESUME DOCUMENT LIFECYCLE & PROTECTION RULES

1. **Private Storage Isolation:**
   - Resumes are stored strictly in non-public object storage buckets (`storage_provider: 's3'`).
   - Direct public HTTP bucket URLs are strictly prohibited.
2. **Dynamic Short-Lived Signed URLs:**
   - Download or view links are signed on-demand with an expiration of 15 minutes.
   - Signed URL generation verifies that the requesting user is either the resume owner or an authorized administrator.
3. **Magic Byte Validation:**
   - Files are validated against binary magic bytes `%PDF-` or PK ZIP prior to database registration.
   - Files containing suspicious macros, shell scripts, or disguised executables are immediately rejected.
4. **Log Sanitization:**
   - Plaintext resume text, candidate phone numbers, and full resume binaries must never appear in server logs or external APM telemetry.

---

## 3. RIGHT TO ERASURE & ACCOUNT DELETION WORKFLOW

When a candidate requests account deletion:
1. `DELETE FROM candidates WHERE id = $1;` triggers foreign key `ON DELETE CASCADE` across `external_identities`, `resumes`, and `saved_jobs`.
2. Asynchronous job dispatches to purge physical resume files from S3-compatible storage.
3. Historical applications update candidate identifier to a cryptographically hashed pseudonym (`anon_<sha256>`) to preserve aggregate reporting integrity without preserving personal data.
