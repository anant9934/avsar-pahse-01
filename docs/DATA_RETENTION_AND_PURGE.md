# AVSAR PLATFORM — DATA RETENTION, ARCHIVAL & PURGE POLICY

**System:** Avsar Recruitment Platform (AI Tathastu)  
**Compliance Standard:** India DPDP Act (2023), GDPR Candidate Privacy Standards  
**Target Scale:** 5,000–8,000 registered candidates, ~1,000 concurrent active users  
**Author:** Anant Kumar <anant9934@users.noreply.github.com>  
**Version:** 1.0.0 (Production Release Assurance)  

---

## 1. Governance Principles & Legal Basis

The Avsar platform processes candidate personally identifiable information (PII), academic transcripts, and resumes. To honor privacy rights and prevent unbounded database bloat, data lifecycle management enforces strict retention, automated expiration, and cryptographic purge controls.

### 1.1 Core Principles
1. **Purpose Limitation:** Candidate data is collected solely for job discovery, matching, and employer application dispatch.
2. **Storage Limitation:** Records are retained only for the duration required to satisfy recruitment, placement cell reporting, and legal audit requirements.
3. **Right to Erasure (DPDP & GDPR):** Candidates may request complete erasure of their account, profile, and uploaded resume files at any time.

---

## 2. Retention Schedules by Entity

| Data Entity | Storage Location | Retention Window | Justification | Purge Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **Active Candidate Profiles** | PostgreSQL `candidates` | Active account lifetime | Core service delivery | User-initiated or after 24m inactivity |
| **Candidate Resumes (Files)** | AWS S3 Bucket | Active account lifetime | Application delivery | S3 Object Deletion + WAL tombstone |
| **Job Applications** | PostgreSQL `applications` | 36 months | Campus recruitment audits | Soft-delete + archival to cold storage |
| **Audit Logs** | PostgreSQL `audit_events` | 12 months | Security forensic auditing | Monthly automated rolling truncation |
| **Idempotency Keys** | PostgreSQL `idempotency_keys`| 24 hours (TTL) | Network retry deduplication | Daily cron purge: `expires_at < NOW()` |
| **Durable Jobs (Completed)** | PostgreSQL `durable_jobs` | 7 days | Operational verification | Daily cron purge: `status = 'completed'` |
| **Dead-Letter Jobs (Failed)** | PostgreSQL `durable_jobs` | 90 days | Incident post-mortem & replay | Quarantine review before manual purge |

---

## 3. Cryptographic Erasure & Purge Workflow

When a candidate requests account deletion or an inactive account reaches its purge date:

```
[ Deletion Request ]
         |
         v
+--------------------------------------------------------+
| 1. S3 Object Deletion (Hard Delete)                    |
|    - Retrieve storage keys from `resumes` table        |
|    - Invoke S3 DeleteObjectCommand                     |
|    - S3 Versioning deletes all historical versions     |
+--------------------------------------------------------+
         |
         v
+--------------------------------------------------------+
| 2. PostgreSQL Cascading Deletion (ACID Transaction)    |
|    - DELETE FROM candidates WHERE id = $1              |
|    - ON DELETE CASCADE purges:                         |
|      * `external_identities`                           |
|      * `resumes`                                       |
|      * `saved_jobs`                                    |
|      * `applications` (or anonymizes candidate_id)     |
+--------------------------------------------------------+
         |
         v
+--------------------------------------------------------+
| 3. Distributed Cache & Session Invalidation            |
|    - Purge tag `cand:<id>` in Upstash Redis            |
|    - Clear active candidate PIN in replica router      |
+--------------------------------------------------------+
         |
         v
+--------------------------------------------------------+
| 4. Security Audit Log Entry (Anonymized)               |
|    - Record `CANDIDATE_ACCOUNT_PURGED` in audit_events |
+--------------------------------------------------------+
```

---

## 4. Automated Daily Maintenance Tasks

The following SQL queries are executed by the daily scheduled maintenance job (`scripts/daily-maintenance.mjs`):

```sql
-- 1. Purge expired idempotency keys
DELETE FROM idempotency_keys
WHERE expires_at < NOW();

-- 2. Purge completed durable queue jobs older than 7 days
DELETE FROM durable_jobs
WHERE status = 'completed'
  AND updated_at < NOW() - INTERVAL '7 days';

-- 3. Purge audit log events older than 365 days
DELETE FROM audit_events
WHERE created_at < NOW() - INTERVAL '365 days';
```

---

## 5. Audit & Compliance Verification

- **Storage Reconciliation:** Run `auditStorageIntegrity()` weekly to detect any orphaned S3 files whose DB references were deleted.
- **Verification Command:**
  ```bash
  npm test test/storage-reconciliation.test.mjs
  ```
