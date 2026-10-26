# PostgreSQL Database Architecture & Migration Guide

## Overview

Avsar features a production-grade dual persistence model:
1. **PostgreSQL** (Primary Production Database): Uses connection pooling, normalized relations, and ACID transaction boundaries.
2. **File Repository** (Local & Edge Fallback): High-performance JSON-backed repository (`data/db.json`) enabling zero-configuration offline development and serverless portability.

This document details the PostgreSQL schema design, connection pooling parameters, indexes, and the automated migration runner.

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
- **Max Connections**: `20`
- **Idle Timeout**: `30,000 ms`
- **Connection Timeout**: `5,000 ms`
- **Keep-Alive**: Enabled with 10-second initial delay.

### Strategic Indexes
- `idx_jobs_slug` ON `jobs(slug)`
- `idx_jobs_verified` ON `jobs(verified)`
- `idx_applications_candidate` ON `applications(candidate_id)`
- `idx_applications_job` ON `applications(job_id)`
- `idx_resumes_candidate` ON `resumes(candidate_id)`

---

## Migration Runner (`scripts/migrate-to-postgres.mjs`)

Avsar includes an automated, idempotent migration CLI:

```bash
# Dry-run validation (checks schema, parses data/db.json, verifies constraints without writing)
node scripts/migrate-to-postgres.mjs --dry-run

# Live execution
DATABASE_URL="postgres://user:password@localhost:5432/avsar" node scripts/migrate-to-postgres.mjs
```

### Safety Features
1. **Transaction Wrapped**: All operations execute within a single transaction block (`BEGIN ... COMMIT`).
2. **Schema Validation**: Automatically creates missing tables and indexes if they do not exist (`CREATE TABLE IF NOT EXISTS`).
3. **Backup Guarantee**: Creates a timestamped snapshot of `data/db.json` before initiating live transfers.
4. **Conflict Resolution**: Uses `ON CONFLICT DO UPDATE` to safely handle re-runs without data loss.
