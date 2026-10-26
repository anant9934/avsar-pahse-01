# Neon Serverless PostgreSQL Migration Runbook & Architecture

## Overview

Avsar features a robust production-grade persistence model:
1. **Neon Serverless PostgreSQL** (Primary Production Database): Uses PgBouncer connection pooling (`-pooler.neon.tech`), normalized relations, strategic B-tree indexes, ACID transaction boundaries, and zero-copy branching.
2. **File Repository** (Local Development Fallback): Development-only JSON-backed repository (`data/db.json`) enabling zero-configuration offline development. Prohibited in production.

Related Documentation:
- Complete Relational Schema: [`docs/DATABASE_SCHEMA.md`](file:///Users/quantum/Desktop/avsar/docs/DATABASE_SCHEMA.md)
- Neon Console Setup & Operations: [`docs/NEON_SETUP.md`](file:///Users/quantum/Desktop/avsar/docs/NEON_SETUP.md)
- DDL Schema Definition: [`src/lib/db/schema.sql`](file:///Users/quantum/Desktop/avsar/src/lib/db/schema.sql)

---

## Schema Architecture

The normalized schema resides in [`src/lib/db/schema.sql`](file:///Users/quantum/Desktop/avsar/src/lib/db/schema.sql) and defines the following core tables:

### 1. `candidates`
Stores candidate profile data, educational background, skills, and graduation eligibility:
- `id` (VARCHAR PRIMARY KEY)
- `email` (VARCHAR UNIQUE NOT NULL)
- `name` (VARCHAR NOT NULL)
- `phone`, `current_location`, `experience_years`, `expected_salary`
- `skills` (JSONB / TEXT ARRAY)
- `education` (JSONB)
- `graduation_year` (INTEGER)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 2. `jobs`
Stores normalized job listings with verification metadata:
- `id` (VARCHAR PRIMARY KEY)
- `slug` (VARCHAR UNIQUE NOT NULL)
- `title` (VARCHAR NOT NULL)
- `company` (VARCHAR NOT NULL)
- `company_logo` (VARCHAR)
- `location` (VARCHAR NOT NULL)
- `work_arrangement` (VARCHAR NOT NULL)
- `compensation` (VARCHAR NOT NULL)
- `experience_level` (VARCHAR NOT NULL)
- `min_experience`, `max_experience` (INTEGER)
- `skills` (JSONB / TEXT ARRAY)
- `eligible_batch_years` (JSONB / INT ARRAY)
- `verified` (BOOLEAN DEFAULT TRUE)
- `source_id` (VARCHAR)
- `external_apply_url` (VARCHAR)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 3. `resumes`
Stores candidate resume metadata linked to durable object/local storage:
- `id` (VARCHAR PRIMARY KEY)
- `candidate_id` (VARCHAR REFERENCES candidates(id) ON DELETE CASCADE)
- `file_name` (VARCHAR NOT NULL)
- `file_size` (VARCHAR NOT NULL)
- `storage_provider` (VARCHAR NOT NULL DEFAULT 'local')
- `storage_key` (VARCHAR NOT NULL)
- `is_primary` (BOOLEAN DEFAULT FALSE)
- `created_at` (TIMESTAMPTZ)

### 4. `applications`
Tracks candidate job submissions with immutable reference numbers:
- `id` (VARCHAR PRIMARY KEY)
- `reference_number` (VARCHAR UNIQUE NOT NULL)
- `job_id` (VARCHAR REFERENCES jobs(id) ON DELETE RESTRICT)
- `candidate_id` (VARCHAR REFERENCES candidates(id) ON DELETE CASCADE)
- `resume_id` (VARCHAR REFERENCES resumes(id))
- `status` (VARCHAR NOT NULL DEFAULT 'Under Review')
- `answers` (JSONB)
- `applied_at` (TIMESTAMPTZ DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ DEFAULT NOW())
- **Constraint**: `UNIQUE(job_id, candidate_id)` prevents duplicate applications.

### 5. `saved_jobs`
Stores candidate bookmarked jobs:
- `candidate_id` (VARCHAR REFERENCES candidates(id) ON DELETE CASCADE)
- `job_id` (VARCHAR REFERENCES jobs(id) ON DELETE CASCADE)
- `created_at` (TIMESTAMPTZ DEFAULT NOW())
- **Primary Key**: `(candidate_id, job_id)`

---

## Connection Pooling & Performance

PostgreSQL connections are managed via `pg.Pool` in [`src/lib/db/postgres.ts`](file:///Users/quantum/Desktop/avsar/src/lib/db/postgres.ts):
- **Max Connections**: `20` (Configurable via `DB_POOL_MAX`)
- **Idle Timeout**: `30,000 ms` (Configurable via `DB_POOL_IDLE_TIMEOUT_MS`)
- **Connection Timeout**: `5,000 ms` (Configurable via `DB_POOL_CONNECTION_TIMEOUT_MS`)
- **Keep-Alive**: Enabled with 10-second initial delay.

### Strategic B-Tree Indexes
- `idx_jobs_slug` ON `jobs(slug)`
- `idx_jobs_verified` ON `jobs(verified)`
- `idx_applications_candidate` ON `applications(candidate_id)`
- `idx_applications_job` ON `applications(job_id)`
- `idx_resumes_candidate` ON `resumes(candidate_id)`

---

## Production Migration Runbook

Follow these exact steps when deploying to a cloud-managed PostgreSQL instance (Neon, Supabase, AWS RDS, GCP Cloud SQL).

### Step 1: Pre-flight Dry Run
Run dry-run validation to verify schema parsing and source dataset integrity without touching the database:

```bash
node scripts/migrate-to-postgres.mjs --dry-run
```
*Expected Output: Confirms candidate count (1), total jobs (131), verified jobs (48), and creates a recovery backup.*

### Step 2: Configure Environment
Set `DATABASE_URL` with SSL mode enabled:

```bash
export DATABASE_URL="postgresql://avsar_admin:your_secure_password@ep-example-pooler.ap-southeast-1.aws.neon.tech/avsar?sslmode=require"
```

### Step 3: Execute Live Migration
Execute the migration script:

```bash
node scripts/migrate-to-postgres.mjs
```

### Step 4: Verification Queries
Verify row counts and constraints directly in `psql`:

```sql
-- 1. Verify Job Count (Must match source total: 131)
SELECT COUNT(*) AS total_jobs FROM jobs;

-- 2. Verify Verified Listings (Must be 48)
SELECT COUNT(*) AS verified_jobs FROM jobs WHERE verified = TRUE;

-- 3. Verify Candidate Profiles
SELECT COUNT(*) AS total_candidates FROM candidates;

-- 4. Verify Active Applications
SELECT COUNT(*) AS total_applications FROM applications;

-- 5. Test Uniqueness Constraint (Should throw duplicate key error)
-- INSERT INTO saved_jobs (candidate_id, job_id) VALUES ('cand_rohan_sharma_001', 'job_flipkart_da');
```

### Step 5: Rollback & Recovery Procedures
- **Transaction Rollback**: If any individual statement fails during migration execution, the script automatically triggers `ROLLBACK` and restores the database to its pristine pre-migration state.
- **Source Snapshot**: The migration CLI automatically writes a timestamped JSON snapshot before executing: `data/db.json.migration-backup-<timestamp>.json`.
- **Manual Restore**: In the event of an unforeseen data conflict, the file repository can be immediately restored via:
  ```bash
  cp data/db.json.migration-backup-*.json data/db.json
  ```
