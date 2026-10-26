# SRE OPERATIONAL RUNBOOK: DATA CORRUPTION & SCHEMA DRIFT RECOVERY

**Severity:** P1 — Critical (Data Integrity Incident)  
**Target Service:** PostgreSQL Schema, Migration Ledger (`schema_migrations`), Audit Log  
**SLO Impact:** Silent data loss risk, foreign key failures, application crashes  
**Owner:** Principal Database Architect / Lead DBRE  

---

## 1. Symptoms & Incident Detection

Data corruption or schema drift is detected when:
1. Schema migration runner fails on startup or deployment:
   - `Migration 00X failed: relation already exists`
   - `Schema checksum mismatch in migration ledger`
2. Application logs report relational constraint violations:
   - `23503: foreign_key_violation` (e.g. applications referencing non-existent jobs)
   - `23505: unique_violation` (unexpected collisions in deduplicated keys)
   - `22P02: invalid_text_representation` in JSONB columns
3. `scripts/verify-backup.mjs` fails in CI/CD or operational health check.

---

## 2. Immediate Containment & Isolation (T+0 to T+5 minutes)

1. **Activate Maintenance Gate Immediately:**
   ```bash
   vercel env add FEATURE_FLAG_MAINTENANCE_MODE true production
   vercel redeploy
   ```
   *Purpose:* Freezes all incoming write traffic to prevent compounding corruption.
2. **Take an Immediate Neon Snapshot:**
   ```bash
   neon branches create --project-id <project-id> --parent main --name "quarantine-before-repair-$(date +%s)"
   ```
   *Purpose:* Preserves forensic evidence and guarantees ability to inspect pre-repair state.

---

## 3. Forensic Investigation & Drift Analysis

### Step 1: Inspect Migration Ledger
```sql
SELECT version, name, applied_at
FROM schema_migrations
ORDER BY applied_at DESC;
```
Identify the latest migration version and verify against codebase migration files in `scripts/migrations/`.

### Step 2: Query Audit Events for Rogue Mutations
Trace who or what executed the corrupting queries:
```sql
SELECT id, actor_type, actor_id, action, resource_type, resource_id, metadata, ip_address, created_at
FROM audit_events
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 50;
```

### Step 3: Run DDL Schema Integrity Auditor
```bash
node scripts/verify-backup.mjs src/lib/db/schema.sql
```
Verifies if any critical tables (`candidates`, `jobs`, `applications`, `resumes`, `idempotency_keys`, `durable_jobs`) or indexes were inadvertently dropped.

---

## 4. Remediation Procedures

### Procedure A: Fixing Orphaned Application Records
If jobs were deleted without cascading properly, identify and clean up orphaned records:
```sql
-- 1. Identify dangling applications (dry-run)
SELECT a.id, a.candidate_id, a.job_id
FROM applications a
LEFT JOIN jobs j ON a.job_id = j.id
WHERE j.id IS NULL;

-- 2. If valid, archive to quarantined table before deleting
CREATE TABLE IF NOT EXISTS orphaned_applications_backup AS
SELECT a.* FROM applications a
LEFT JOIN jobs j ON a.job_id = j.id
WHERE j.id IS NULL;

-- 3. Remove dangling records
DELETE FROM applications
WHERE id IN (SELECT id FROM orphaned_applications_backup);
```

### Procedure B: Schema Drift Repair
If an index or column was dropped out-of-band:
1. Execute the authoritative DDL statements from `src/lib/db/schema.sql`.
2. Confirm that all `CREATE INDEX IF NOT EXISTS` statements re-establish missing indexes without locking tables (use `CONCURRENTLY` if running on live production).

### Procedure C: Full Point-in-Time Recovery (PITR)
If corruption spans across multiple relational tables:
1. Determine the exact timestamp `$T_CORRUPTION` from `audit_events`.
2. Provision a restored branch at `$T_CORRUPTION - 60 seconds`:
   ```bash
   neon branches create --parent main --timestamp "2026-10-26T22:15:00Z" --name "restored-main-$(date +%s)"
   ```
3. Update `POSTGRES_URL` in Vercel to point to the restored branch.

---

## 5. Verification & Health Restoration

1. **Run DDL Auditor:**
   ```bash
   node scripts/verify-backup.mjs src/lib/db/schema.sql
   ```
2. **Execute Full Project Regression Test Suite:**
   ```bash
   npm test
   ```
3. **Verify Health Readiness:**
   ```bash
   curl -s -i https://avsar.aitathastu.org/api/health/ready
   ```
4. **Disable Maintenance Mode:**
   ```bash
   vercel env rm FEATURE_FLAG_MAINTENANCE_MODE production
   vercel redeploy
   ```
5. Author formal Post-Incident Review (PIR) documenting the root cause, blast radius, and preventative controls.
