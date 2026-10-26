# SRE OPERATIONAL RUNBOOK: QUEUE BACKLOG & DEAD-LETTER QUEUE (DLQ) REMEDIATION

**Severity:** P2 — High (Delayed Processing / Asynchronous Task Latency)  
**Target Service:** Asynchronous Processing (`DurableQueueProvider`, `durable_jobs`, `TransactionalOutbox`)  
**SLO Impact:** Delayed application confirmation emails, stale match score recalculations  
**Owner:** Backend Infrastructure SRE / Queue Reliability Engineer  

---

## 1. Symptoms & Incident Detection

A queue backlog or worker failure incident is signaled when:
1. Restricted diagnostics endpoint `/api/health/diagnostics` reports:
   - `diagnostics.queue.durable.pendingCount > 250`
   - `diagnostics.queue.deadLetter.totalFailed > 20`
2. Candidates report delayed email confirmations or missing match score updates on job detail pages.
3. Database query on `durable_jobs` indicates old pending or leased records:
   ```sql
   SELECT count(*) FROM durable_jobs WHERE status = 'pending' AND created_at < NOW() - INTERVAL '15 minutes';
   ```

---

## 2. Immediate Triage & Diagnostics (T+0 to T+5 minutes)

### Step 1: Execute SRE Dead-Letter Inspection Tool
Run the operational CLI tool to inspect failure aggregations:
```bash
# 1. View high-level DLQ summary by job type and failure error
node scripts/replay-dlq.mjs summary

# 2. Inspect individual failed jobs and stack traces
node scripts/replay-dlq.mjs inspect --limit 10
```

### Step 2: Categorize Root Cause
- **Downstream Dependency Outage (e.g., SMTP / S3):**
  - Error: `ECONNREFUSED mail.aitathastu.org` or `ETIMEDOUT s3.ap-southeast-1.amazonaws.com`.
  - Action: DO NOT purge jobs. Wait for downstream recovery, then replay.
- **Worker Starvation (Lease Expiration):**
  - Jobs are stuck in `status = 'leased'` because serverless functions terminated prematurely before calling `ack()`.
  - Action: Reclaim expired leases.
- **Poison Pill:**
  - Corrupted job payload (e.g. invalid JSON, missing candidate ID).
  - Action: Isolate poison pill, patch handler logic, and replay.

---

## 3. Remediation Procedures

### Procedure A: Reclaiming Stale / Expired Leases
If worker nodes crashed while processing jobs:
```sql
UPDATE durable_jobs
SET status = 'pending',
    lease_id = NULL,
    leased_until = NULL,
    updated_at = NOW()
WHERE status = 'leased'
  AND leased_until < NOW();
```
*Result:* Returns stale jobs to the active queue pool for immediate lease by healthy workers.

### Procedure B: Safe Batch Replay via DLQ CLI
Once the underlying bug or dependency outage is resolved:
1. **Always run dry-run first:**
   ```bash
   node scripts/replay-dlq.mjs replay --type resume_parsing --dry-run
   ```
2. **Execute live replay:**
   ```bash
   node scripts/replay-dlq.mjs replay --type resume_parsing --batch-size 50
   ```
3. Verify that `durable_jobs` resets `attempts = 0` and sets `status = 'pending'`.

### Procedure C: Handling Poison Pills
If a specific job ID consistently crashes worker execution:
```sql
-- Move poison pill to quarantine table or set status to 'quarantined'
UPDATE durable_jobs
SET status = 'quarantined',
    failed_reason = 'MANUAL_QUARANTINE: Poison pill identified during INC-4819'
WHERE id = 'job_corrupted_uuid_123';
```

---

## 4. Verification & Health Audit

1. **Verify Queue Depth Returns to Zero:**
   ```bash
   curl -s -H "x-admin-key: $AVSAR_ADMIN_SECRET" https://avsar.aitathastu.org/api/health/diagnostics | jq '.diagnostics.queue'
   ```
   *Expected:* `durable.pendingCount: 0`, `durable.processingCount: 0`.
2. **Execute Queue Regression Tests:**
   ```bash
   npm test test/postgres-queue.test.mjs test/dead-letter.test.mjs test/dlq-cli.test.mjs
   ```
3. **Verify Outbox Drain:** Confirm `outbox_events` has zero unprocessed rows older than 5 minutes.
