# SRE OPERATIONAL RUNBOOK: DATABASE OUTAGE & FAILOVER

**Severity:** P1 — Critical (User-Facing Outage)  
**Target Service:** Neon Serverless PostgreSQL / Database Access Layer  
**SLO Impact:** Immediate error budget burn; `/api/health/ready` returns HTTP 503  
**Owner:** Database Reliability Engineer (DBRE) / On-Call SRE  

---

## 1. Symptoms & Incident Detection

An active database outage is triggered when:
1. `/api/health/ready` returns HTTP 503 with `checks.database.ready: false`.
2. Vercel function logs report recurring error codes:
   - `ECONNREFUSED` / `ETIMEDOUT` / `ENOTFOUND`
   - `57P01` (admin_shutdown)
   - `08006` (connection_failure)
   - `XX000` (internal_error)
3. Platform circuit breaker for PostgreSQL flips to `OPEN`, returning fail-safe mock responses or 503 Service Unavailable.

---

## 2. Immediate Triage & Containment (T+0 to T+5 minutes)

1. **Acknowledge PagerDuty Alert:** Assign incident commander and join the `#incident-war-room` Slack channel.
2. **Enable Global Maintenance Mode (if write errors cascade):**
   In Vercel dashboard or CLI:
   ```bash
   vercel env add FEATURE_FLAG_MAINTENANCE_MODE true production
   vercel redeploy
   ```
   *Rationale:* Halts writes from candidate submissions, preserving queue and outbox state without partial commits.
3. **Inspect Neon Console:**
   - Check compute state in the Neon project dashboard (`https://console.neon.tech`).
   - Determine if the compute is `IDLE`, `SUSPENDED`, `RUNNING`, or `ERROR`.

---

## 3. Remediation Procedures

### Procedure A: Neon Compute Stuck or Unresponsive
If storage is healthy but compute failed to spin up:
1. Trigger a manual compute restart in Neon console or via CLI:
   ```bash
   neon compute restart --project-id <project-id> --compute-id <compute-id>
   ```
2. Verify connectivity from a bastion/developer host:
   ```bash
   node scripts/verify-backup.mjs src/lib/db/schema.sql
   ```

### Procedure B: Corrupted Primary Branch — Point-in-Time Restore (PITR)
If the database suffered table corruption or unrecoverable WAL damage:
1. Identify the latest known healthy timestamp `$T_SAFE` (e.g., 10 minutes prior to incident).
2. Create a child recovery branch directly from the PITR history:
   ```bash
   neon branches create \
     --project-id <project-id> \
     --parent main \
     --timestamp "2026-10-26T22:30:00Z" \
     --name "recovery-pitr-$(date +%s)"
   ```
3. Retrieve connection string of the new branch:
   ```bash
   neon connection-string "recovery-pitr-<timestamp>" --pooled
   ```
4. Update `POSTGRES_URL` in Vercel environment variables:
   ```bash
   vercel env rm POSTGRES_URL production
   vercel env add POSTGRES_URL "<new_pooled_connection_string>" production
   ```
5. Trigger zero-downtime deployment:
   ```bash
   vercel --prod
   ```

### Procedure C: Read-Replica Failover
If `checkReplicationLag()` indicates `LAGGING` or `UNAVAILABLE`:
1. The application's `shouldRouteToPrimary()` router automatically falls back to primary write pool for all queries.
2. Verify replica health:
   ```sql
   SELECT pg_is_in_recovery(), pg_last_xact_replay_timestamp();
   ```
3. If replica compute crashed, provision replacement read replica branch in Neon and update `POSTGRES_READ_REPLICA_URL`.

---

## 4. Verification & Recovery Validation

1. **Check Readiness Endpoint:**
   ```bash
   curl -s -i https://avsar.aitathastu.org/api/health/ready
   ```
   *Expected:* HTTP 200 with `status: "ready"` and `database.ready: true`.
2. **Execute Full Smoke Test Suite:**
   ```bash
   npm test test/database-storage.test.mjs
   ```
3. **Disable Maintenance Mode:**
   ```bash
   vercel env rm FEATURE_FLAG_MAINTENANCE_MODE production
   ```
4. **Monitor Error Rates:** Observe Datadog / Vercel Analytics for 15 minutes to confirm error rate is below 0.1%.
