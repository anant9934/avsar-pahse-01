-- ==============================================================================
-- AVSAR DATABASE MIGRATION 002: HIGH-CONCURRENCY COMPOSITE & PARTIAL INDEXES
-- ==============================================================================
-- Optimizes query performance under 1,000 concurrent active users by eliminating
-- sequential table scans on active job listings, candidate applications, saved jobs,
-- and primary resume lookups.
-- ==============================================================================

-- 1. Active Jobs Partial & Composite Index (Optimizes GET /api/jobs default view)
CREATE INDEX IF NOT EXISTS idx_jobs_active_created
ON jobs (created_at DESC)
WHERE is_possibly_closed = FALSE;

-- 2. Category + Active Jobs Filter Index (Optimizes faceted search)
CREATE INDEX IF NOT EXISTS idx_jobs_category_active
ON jobs (category, created_at DESC)
WHERE is_possibly_closed = FALSE;

-- 3. Work Arrangement + Active Jobs Index
CREATE INDEX IF NOT EXISTS idx_jobs_arrangement_active
ON jobs (work_arrangement, created_at DESC)
WHERE is_possibly_closed = FALSE;

-- 4. Full-Text Search Vector Index on Title and Company
CREATE INDEX IF NOT EXISTS idx_jobs_fts_title_company
ON jobs USING gin (to_tsvector('english', title || ' ' || company));

-- 5. Applications Candidate History Composite Index (Optimizes candidate dashboard)
CREATE INDEX IF NOT EXISTS idx_applications_candidate_applied
ON applications (candidate_id, applied_at DESC);

-- 6. Applications Job Status Composite Index (Optimizes admin review & duplicate check)
CREATE INDEX IF NOT EXISTS idx_applications_job_status
ON applications (job_id, status);

-- 7. Saved Jobs Candidate History Index (Optimizes candidate bookmarks query)
CREATE INDEX IF NOT EXISTS idx_saved_jobs_candidate_created
ON saved_jobs (candidate_id, created_at DESC);

-- 8. Resumes Candidate Primary Lookup Index (Optimizes primary resume resolution)
CREATE INDEX IF NOT EXISTS idx_resumes_candidate_primary
ON resumes (candidate_id, is_primary);

-- 9. Audit Events Actor History Composite Index (Optimizes security incident inspection)
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_created
ON audit_events (actor_id, created_at DESC);

-- 10. External Identities Provider Composite Index
CREATE INDEX IF NOT EXISTS idx_external_identities_provider_user
ON external_identities (provider, provider_user_id);
