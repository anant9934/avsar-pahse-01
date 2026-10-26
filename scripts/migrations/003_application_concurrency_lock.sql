-- ==============================================================================
-- AVSAR DATABASE MIGRATION 003: SCHEMA VERSIONING, IDEMPOTENCY & DURABLE QUEUE
-- ==============================================================================
-- 1. Establishes schema_migrations tracking table for controlled release lifecycle.
-- 2. Adds idempotency_keys table for network retry deduplication under high concurrency.
-- 3. Adds durable_jobs table for transactional PostgreSQL background worker leasing.
-- ==============================================================================

-- 1. Schema Migrations Ledger
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial migration milestones if not already tracked
INSERT INTO schema_migrations (version, name)
VALUES 
    ('001', 'initial_schema'),
    ('002', 'concurrency_indexes'),
    ('003', 'application_concurrency_lock')
ON CONFLICT (version) DO NOTHING;

-- 2. Idempotency Keys (Deduplicates mutation requests and replays cached response)
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

CREATE INDEX IF NOT EXISTS idx_idempotency_expires
ON idempotency_keys (expires_at);

CREATE INDEX IF NOT EXISTS idx_idempotency_candidate_scope
ON idempotency_keys (candidate_id, scope);

-- 3. Durable Transactional Background Jobs (ACID Queue with SKIP LOCKED)
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

-- Index for sub-millisecond worker polling using SELECT ... FOR UPDATE SKIP LOCKED
CREATE INDEX IF NOT EXISTS idx_durable_jobs_polling
ON durable_jobs (status, priority, created_at)
WHERE status IN ('pending', 'leased');

CREATE INDEX IF NOT EXISTS idx_durable_jobs_type
ON durable_jobs (type, status);
