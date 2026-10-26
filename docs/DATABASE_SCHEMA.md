# Avsar Relational Database Schema Specification

> **Platform:** Avsar by AI Tathastu  
> **Database:** Neon Serverless PostgreSQL (PostgreSQL 14+)  
> **Schema Definition File:** [`src/lib/db/schema.sql`](file:///Users/quantum/Desktop/avsar/src/lib/db/schema.sql)  
> **Author:** Anant Kumar (`anant9934@users.noreply.github.com`)  

---

## 1. Schema Architecture Principles

The Avsar database architecture is built upon core relational principles:
1. **Explicit Identity Isolation:** Every candidate entity is keyed by a stable primary key (`id`) and mapped to an authoritative identity provider (`external_identities`) using the immutable AI Tathastu UUID (`provider_user_id`).
2. **Database-Level Integrity Constraints:** Uniqueness and concurrency guarantees (e.g. duplicate application prevention, duplicate saved job prevention) are enforced directly in the database engine via unique composite constraints.
3. **Optimized Indexes for High Concurrency:** B-tree indexes are placed on high-frequency filtering and join columns (`candidate_id`, `job_id`, `company`, `work_arrangement`, `employment_type`, `verification_status`).
4. **Relational Structure with Structured JSONB:** Core entities use strictly typed SQL columns for relational queries; variable-length, nested metadata (such as skills, interview feedback answers, requirements, and raw source payloads) utilize PostgreSQL `JSONB`.

---

## 2. Table Specifications

### 2.1. `candidates` (Core Candidate Identity & Profile)
Stores candidate demographic details, qualifications, and calculated ERIS metrics.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(255)` | `PRIMARY KEY` | Stable candidate identifier (e.g., `cand_rohan_sharma_001` or UUID) |
| `name` | `VARCHAR(255)` | `NOT NULL` | Full name of the candidate |
| `headline` | `VARCHAR(255)` | `NULLABLE` | Professional headline or student status |
| `email` | `VARCHAR(255)` | `NOT NULL` | Primary contact email address |
| `phone` | `VARCHAR(50)` | `NULLABLE` | Candidate contact telephone number |
| `location` | `VARCHAR(255)` | `NULLABLE` | Current geographic city/state |
| `avatar` | `TEXT` | `NULLABLE` | URL or asset path to profile avatar |
| `bio` | `TEXT` | `NULLABLE` | Summary biographical narrative |
| `skills` | `JSONB` | `NOT NULL DEFAULT '[]'` | Array of canonical skill strings |
| `education` | `JSONB` | `NOT NULL DEFAULT '[]'` | Education credentials (degree, college, graduation year) |
| `experience` | `JSONB` | `NOT NULL DEFAULT '[]'` | Work experience history |
| `projects` | `JSONB` | `NOT NULL DEFAULT '[]'` | Portfolio projects |
| `preferences` | `JSONB` | `NOT NULL DEFAULT '{}'` | Role, compensation, and location preferences |
| `eris_score` | `INTEGER` | `NOT NULL DEFAULT 85` | Early Readiness & Intelligence Score (0–100) |
| `profile_completion_percentage` | `INTEGER` | `NOT NULL DEFAULT 50` | Completion indicator for dashboard progress |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last update timestamp |

---

### 2.2. `external_identities` (IdP Mapping)
Maps candidates to external OAuth 2.0 / OIDC identity providers.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(255)` | `PRIMARY KEY` | Identity record UUID |
| `candidate_id` | `VARCHAR(255)` | `NOT NULL REFERENCES candidates(id) ON DELETE CASCADE` | Associated candidate record |
| `provider` | `VARCHAR(50)` | `NOT NULL DEFAULT 'aitathastu'` | Identity provider tag (`aitathastu`, `google`) |
| `provider_user_id` | `VARCHAR(255)` | `NOT NULL` | Authoritative UUID from IdP (`sub` claim) |
| `email` | `VARCHAR(255)` | `NULLABLE` | Email reported by the provider |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Link creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last sync timestamp |

**Constraints & Indexes:**
- `CONSTRAINT unique_provider_identity UNIQUE (provider, provider_user_id)`
- `idx_external_identities_candidate ON (candidate_id)`
- `idx_external_identities_lookup ON (provider, provider_user_id)`

---

### 2.3. `jobs` (Opportunities & Verification Metadata)
Stores job and internship opportunities, including compensation, verification, and link metadata.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(255)` | `PRIMARY KEY` | Deterministic job identifier |
| `slug` | `VARCHAR(255)` | `NOT NULL` | URL-safe slug for routing |
| `title` | `VARCHAR(255)` | `NOT NULL` | Job role title |
| `company` | `VARCHAR(255)` | `NOT NULL` | Employing organization name |
| `company_logo_key` | `VARCHAR(100)` | `NOT NULL DEFAULT 'default'` | Logo lookup key for visual brand assets |
| `location` | `VARCHAR(255)` | `NOT NULL` | Office or remote location |
| `work_arrangement` | `VARCHAR(50)` | `NOT NULL` | `Remote`, `In-office`, `Hybrid` |
| `employment_type` | `VARCHAR(50)` | `NOT NULL` | `Full-time`, `Internship`, `Contract` |
| `compensation` | `VARCHAR(150)` | `NOT NULL` | Formatted salary or stipend display string |
| `deadline` | `VARCHAR(100)` | `NULLABLE` | Application close deadline |
| `category` | `VARCHAR(100)` | `NULLABLE` | Role category |
| `overview` | `TEXT` | `NULLABLE` | Opportunity overview text |
| `requirements` | `JSONB` | `NOT NULL DEFAULT '[]'` | Required qualifications list |
| `responsibilities` | `JSONB` | `NOT NULL DEFAULT '[]'` | Role duties list |
| `benefits` | `JSONB` | `NOT NULL DEFAULT '[]'` | Perks and benefits |
| `required_skills` | `JSONB` | `NOT NULL DEFAULT '[]'` | Mandatory skill tags for matching |
| `optional_skills` | `JSONB` | `NOT NULL DEFAULT '[]'` | Nice-to-have skill tags |
| `min_experience_months` | `INTEGER` | `NOT NULL DEFAULT 0` | Minimum experience required |
| `is_featured` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Homepage priority flag |
| `graduation_years` | `JSONB` | `NOT NULL DEFAULT '[]'` | Eligible batch years (e.g. `[2025, 2026]`) |
| `apply_url` | `TEXT` | `NULLABLE` | Sanitized external application link |
| `application_link_type` | `VARCHAR(255)` | `NULLABLE` | Channel description |
| `verification_status` | `VARCHAR(50)` | `NOT NULL DEFAULT 'UNVERIFIED'` | Verification badge status |
| `is_possibly_closed` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Flag for potentially expired roles |
| `is_external_application` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Flag indicating external ATS redirect |

**Indexes:**
- `idx_jobs_company ON (company)`
- `idx_jobs_work_arrangement ON (work_arrangement)`
- `idx_jobs_employment_type ON (employment_type)`
- `idx_jobs_verification_status ON (verification_status)`
- `idx_jobs_slug ON (slug)`

---

### 2.4. `resumes` (Candidate Resume Documents)
Stores resume file metadata linked to physical object storage.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(255)` | `PRIMARY KEY` | Resume identifier |
| `candidate_id` | `VARCHAR(255)` | `NOT NULL REFERENCES candidates(id) ON DELETE CASCADE` | Owning candidate |
| `file_name` | `VARCHAR(255)` | `NOT NULL` | Original upload filename |
| `file_size` | `VARCHAR(50)` | `NOT NULL` | Human-readable size string |
| `is_primary` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Default selection flag |
| `file_path` | `TEXT` | `NULLABLE` | Local development path |
| `storage_provider` | `VARCHAR(50)` | `NOT NULL DEFAULT 'local'` | Storage mechanism (`s3` or `local`) |
| `storage_key` | `TEXT` | `NULLABLE` | S3 object key |
| `mime_type` | `VARCHAR(100)` | `NOT NULL DEFAULT 'application/pdf'` | Content-Type MIME string |
| `byte_size` | `BIGINT` | `NULLABLE` | Exact byte count |

---

### 2.5. `applications` (Candidate Job Submissions)
Records candidate applications to specific roles with concurrency duplicate prevention.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(255)` | `PRIMARY KEY` | Application record ID |
| `job_id` | `VARCHAR(255)` | `NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT` | Target job |
| `candidate_id` | `VARCHAR(255)` | `NOT NULL REFERENCES candidates(id) ON DELETE CASCADE` | Submitting candidate |
| `status` | `VARCHAR(50)` | `NOT NULL DEFAULT 'Under Review'` | Stage (`Under Review`, `Shortlisted`, `Interview`, `Rejected`) |
| `reference_number` | `VARCHAR(100)` | `NOT NULL UNIQUE` | Tracking code (e.g. `AVS-2025-0814`) |
| `resume_id` | `VARCHAR(255)` | `NOT NULL` | Attached resume ID |
| `resume_name` | `VARCHAR(255)` | `NOT NULL` | Attached resume display name |
| `answers` | `JSONB` | `NOT NULL DEFAULT '{}'` | Responses to questionnaire |
| `applied_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Precise timestamp of application |

**Constraints & Indexes:**
- `CONSTRAINT unique_candidate_job_application UNIQUE (candidate_id, job_id)`
- `idx_applications_candidate ON (candidate_id)`
- `idx_applications_job ON (job_id)`
- `idx_applications_status ON (status)`

---

### 2.6. `saved_jobs` (Candidate Bookmarks)
Tracks candidate bookmarks with unique composite protection.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(255)` | `PRIMARY KEY` | Bookmark record ID |
| `candidate_id` | `VARCHAR(255)` | `NOT NULL REFERENCES candidates(id) ON DELETE CASCADE` | Candidate |
| `job_id` | `VARCHAR(255)` | `NOT NULL REFERENCES jobs(id) ON DELETE CASCADE` | Bookmarked job |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Bookmark timestamp |

**Constraints & Indexes:**
- `CONSTRAINT unique_candidate_saved_job UNIQUE (candidate_id, job_id)`
- `idx_saved_jobs_candidate ON (candidate_id)`
- `idx_saved_jobs_job ON (job_id)`

---

### 2.7. `audit_events` (Security & Audit Trail)
Maintains audit logs for privileged and security-sensitive events.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(255)` | `PRIMARY KEY` | Audit entry ID |
| `actor_type` | `VARCHAR(50)` | `NOT NULL` | `candidate`, `admin`, `system` |
| `actor_id` | `VARCHAR(255)` | `NOT NULL` | Identity of the initiator |
| `action` | `VARCHAR(100)` | `NOT NULL` | Operation name |
| `resource_type` | `VARCHAR(100)` | `NOT NULL` | Target entity type |
| `resource_id` | `VARCHAR(255)` | `NULLABLE` | Target entity ID |
| `metadata` | `JSONB` | `NOT NULL DEFAULT '{}'` | Contextual audit attributes |
| `ip_address` | `VARCHAR(100)` | `NULLABLE` | Remote client IP |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Event timestamp |

---

### 2.8. `import_history` (Dataset Ingestion Logs)
Tracks bulk job import executions, record counts, and synchronization reconciliation.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(255)` | `PRIMARY KEY` | Import batch record ID |
| `batch_id` | `VARCHAR(100)` | `NOT NULL UNIQUE` | Batch UUID |
| `source_platform` | `VARCHAR(100)` | `NOT NULL` | Data origin (`jobs.json`, API sync) |
| `total_records` | `INTEGER` | `NOT NULL DEFAULT 0` | Total records in batch |
| `created_records` | `INTEGER` | `NOT NULL DEFAULT 0` | Newly created rows |
| `updated_records` | `INTEGER` | `NOT NULL DEFAULT 0` | Updated existing rows |
| `skipped_records` | `INTEGER` | `NOT NULL DEFAULT 0` | Unchanged rows skipped |
| `error_records` | `INTEGER` | `NOT NULL DEFAULT 0` | Malformed records rejected |
| `details` | `JSONB` | `NOT NULL DEFAULT '{}'` | Detailed error array and metadata |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Execution timestamp |
