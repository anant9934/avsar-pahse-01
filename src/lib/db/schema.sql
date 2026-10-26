-- ==============================================================================
-- AVSAR PRODUCTION DATABASE SCHEMA (PostgreSQL 14+)
-- ==============================================================================
-- Production-grade normalized schema with ACID constraints, cascade rules,
-- indexes for high-concurrency read/write operations, and auditability.
-- ==============================================================================

-- 1. Candidates table
CREATE TABLE IF NOT EXISTS candidates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    headline VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    location VARCHAR(255),
    avatar TEXT,
    bio TEXT,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    education JSONB NOT NULL DEFAULT '[]'::jsonb,
    experience JSONB NOT NULL DEFAULT '[]'::jsonb,
    projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    eris_score INTEGER NOT NULL DEFAULT 85,
    profile_completion_percentage INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. External identities mapping table (Keyed by stable AI Tathastu UUID)
CREATE TABLE IF NOT EXISTS external_identities (
    id VARCHAR(255) PRIMARY KEY,
    candidate_id VARCHAR(255) NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'aitathastu',
    provider_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_provider_identity UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_external_identities_candidate ON external_identities(candidate_id);
CREATE INDEX IF NOT EXISTS idx_external_identities_lookup ON external_identities(provider, provider_user_id);

-- 3. Jobs table (Preserves all 54 imported real jobs + seed jobs + rich metadata)
CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(255) PRIMARY KEY,
    slug VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    company_logo_key VARCHAR(100) NOT NULL DEFAULT 'default',
    hero_image TEXT,
    location VARCHAR(255) NOT NULL,
    work_arrangement VARCHAR(50) NOT NULL,
    employment_type VARCHAR(50) NOT NULL,
    compensation VARCHAR(150) NOT NULL,
    deadline VARCHAR(100),
    department VARCHAR(100),
    category VARCHAR(100),
    overview TEXT,
    requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    responsibilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    optional_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    min_experience_months INTEGER NOT NULL DEFAULT 0,
    education_requirement TEXT,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    posted_at VARCHAR(100) NOT NULL DEFAULT 'Recently',
    source_job_id VARCHAR(255),
    source_platform VARCHAR(100),
    graduation_years JSONB NOT NULL DEFAULT '[]'::jsonb,
    salary_details JSONB,
    apply_url TEXT,
    application_link_type VARCHAR(255),
    verification_status VARCHAR(50) NOT NULL DEFAULT 'UNVERIFIED',
    verification_note TEXT,
    ppo_claim VARCHAR(100),
    ctc_claim JSONB,
    is_possibly_closed BOOLEAN NOT NULL DEFAULT FALSE,
    is_external_application BOOLEAN NOT NULL DEFAULT FALSE,
    source_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_work_arrangement ON jobs(work_arrangement);
CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON jobs(employment_type);
CREATE INDEX IF NOT EXISTS idx_jobs_verification_status ON jobs(verification_status);
CREATE INDEX IF NOT EXISTS idx_jobs_is_possibly_closed ON jobs(is_possibly_closed);
CREATE INDEX IF NOT EXISTS idx_jobs_source_platform ON jobs(source_platform);
CREATE INDEX IF NOT EXISTS idx_jobs_slug ON jobs(slug);

-- 4. Resumes table (Durable metadata linked to storage provider)
CREATE TABLE IF NOT EXISTS resumes (
    id VARCHAR(255) PRIMARY KEY,
    candidate_id VARCHAR(255) NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size VARCHAR(50) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    file_path TEXT,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'local',
    storage_key TEXT,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    byte_size BIGINT,
    uploaded_at VARCHAR(100) NOT NULL DEFAULT 'Just now',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumes_candidate ON resumes(candidate_id);

-- 5. Applications table (Atomic submission, duplicate prevention)
CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(255) PRIMARY KEY,
    job_id VARCHAR(255) NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    candidate_id VARCHAR(255) NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'Under Review',
    reference_number VARCHAR(100) NOT NULL UNIQUE,
    resume_id VARCHAR(255) NOT NULL,
    resume_name VARCHAR(255) NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_date_formatted VARCHAR(100) NOT NULL DEFAULT 'Applied recently',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_candidate_job_application UNIQUE (candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_candidate ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_reference ON applications(reference_number);

-- 6. Saved jobs table (Candidate bookmarks)
CREATE TABLE IF NOT EXISTS saved_jobs (
    id VARCHAR(255) PRIMARY KEY,
    candidate_id VARCHAR(255) NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    job_id VARCHAR(255) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_candidate_saved_job UNIQUE (candidate_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_jobs_candidate ON saved_jobs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_job ON saved_jobs(job_id);

-- 7. Audit events table (Security, admin, and authentication actions)
CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(255) PRIMARY KEY,
    actor_type VARCHAR(50) NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_type, actor_id);

-- 8. Import history table (Tracks dataset batches and synchronization audits)
CREATE TABLE IF NOT EXISTS import_history (
    id VARCHAR(255) PRIMARY KEY,
    batch_id VARCHAR(100) NOT NULL UNIQUE,
    source_platform VARCHAR(100) NOT NULL,
    total_records INTEGER NOT NULL DEFAULT 0,
    created_records INTEGER NOT NULL DEFAULT 0,
    updated_records INTEGER NOT NULL DEFAULT 0,
    skipped_records INTEGER NOT NULL DEFAULT 0,
    error_records INTEGER NOT NULL DEFAULT 0,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_history_created ON import_history(created_at);

-- 9. Schema migrations table (Version tracking and release integrity)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Idempotency keys table (Network retry deduplication and response caching)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    scope VARCHAR(100) NOT NULL,
    candidate_id VARCHAR(255),
    payload_hash VARCHAR(64) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
    response_code INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys (expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_candidate_scope ON idempotency_keys (candidate_id, scope);

-- 11. Durable jobs table (ACID queue for background processing with SKIP LOCKED)
CREATE TABLE IF NOT EXISTS durable_jobs (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    lease_id VARCHAR(255),
    leased_until TIMESTAMPTZ,
    failed_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_durable_jobs_polling ON durable_jobs (status, priority, created_at)
WHERE status IN ('pending', 'leased');
CREATE INDEX IF NOT EXISTS idx_durable_jobs_type ON durable_jobs (type, status);
