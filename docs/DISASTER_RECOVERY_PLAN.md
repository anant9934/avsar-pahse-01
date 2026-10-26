# AVSAR PLATFORM — DISASTER RECOVERY & BUSINESS CONTINUITY PLAN

**System:** Avsar Recruitment Platform (AI Tathastu)  
**Classification:** Enterprise Tier-1 Mission-Critical Service  
**Target Scale:** 5,000–8,000 registered candidates, ~1,000 concurrent active users, 100–250 RPS  
**Document Version:** 1.0.0 (Production Release Assurance)  
**Owner:** Infrastructure Reliability Engineering (SRE) & Security Team  

---

## 1. Executive Summary & Continuity Objectives

The Avsar Disaster Recovery (DR) Plan defines the technical architecture, operational runbooks, and automated recovery procedures required to restore platform services in the event of catastrophic data center loss, database corruption, infrastructure failure, or operational human error.

### 1.1 Recovery Objectives (SLO-Aligned)

| Metric | Target | Definition |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **≤ 15 minutes** | Maximum allowable data loss window under catastrophic database failover. (Neon WAL archiving achieves point-in-time recovery to within seconds). |
| **RTO (Recovery Time Objective)** | **≤ 30 minutes** | Maximum acceptable duration between declaration of disaster and full restoration of candidate and recruiter application journeys. |
| **Availability Objective** | **99.9%** | Maximum allowable unplanned downtime of ≤ 43.8 minutes per calendar month. |

---

## 2. Platform Architecture & Data Flow Topology

Avsar is architected with clear boundaries between stateless serverless compute, authoritative persistent relational storage, distributed transient caching, and private immutable object storage:

```
                  +--------------------------------+
                  |  Vercel Global Edge Network    |
                  |  (WAF, DDoS Shield, Anycast)   |
                  +---------------+----------------+
                                  |
                +-----------------+-----------------+
                | Next.js Serverless Edge & Node.js |
                | (Ephemeral, Stateless Computes)   |
                +----+------------------------+-----+
                     |                        |
         +-----------v----------+   +---------v---------+
         | Upstash Redis REST   |   | AWS S3 / MinIO    |
         | (Distributed Caching |   | (Private Resumes  |
         | & Sliding Limits)    |   |  Object Storage)  |
         +----------------------+   +-------------------+
                     |
         +-----------v---------------------+
         | Neon Serverless PostgreSQL      |
         | Primary Compute (Active-RW)     |
         | Write-Ahead Log (WAL) Archiving |
         +-----------------+---------------+
                           |
         +-----------------v---------------+
         | Neon Read-Replica / Standby     |
         | (Synchronous / Near Real-time)  |
         +---------------------------------+
```

---

## 3. Storage & Backup Lifecycle Matrix

| Component | Storage Layer | Backup Mechanism | Frequency | Retention Window | Storage Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Relational Data** | Neon PostgreSQL | Continuous WAL Archiving + Daily Logical Dumps (`pg_dump`) | Real-time WAL + Daily 02:00 UTC | 30 days PITR + 90 days cold dumps | Encrypted S3 Bucket (`avsar-backups-immutable`) |
| **Candidate Resumes** | AWS S3 Bucket | S3 Bucket Versioning + Cross-Region Replication (CRR) | Continuous / Event-Driven | Indefinite with 7-year audit policy | Secondary AWS Region (`ap-south-1` to `ap-southeast-1`) |
| **Queue & Outbox** | PostgreSQL | Transactional Outbox + Durable Jobs Table | In-line with database WAL | 30 days | Main Database |
| **Cache & Limits** | Upstash Redis | In-memory ephemeral with AOF persistence | Periodic flush | Transient (No DR restore required) | Upstash managed cloud |

---

## 4. Disaster Scenarios & Failover Procedures

### Scenario A: Neon Primary Database Compute Failure
- **Detection:** Health readiness probe `/api/health/ready` returns HTTP 503 (`database.ready: false`). Circuit breaker trips to OPEN.
- **Root Cause:** Neon compute node crash or regional hardware fault.
- **Failover Action:**
  1. Neon serverless platform automatically provisions a replacement compute instance within 5–15 seconds attached to the same storage pages.
  2. If the primary branch is corrupted, promote the latest point-in-time recovery (PITR) snapshot to active:
     ```bash
     neon branches create --from-point-in-time "2026-10-26T22:30:00Z" --name recovery-branch
     ```
  3. Update Vercel environment variable `POSTGRES_URL` to point to the recovered branch.
  4. Trigger immediate redeployment or runtime variable refresh in Vercel.

### Scenario B: Accidental Data Deletion / Table Corruption
- **Detection:** Recruiter or candidate reports missing records; database audit logs indicate unauthorized `DROP` or `DELETE` without `WHERE`.
- **Mitigation Action:**
  1. Freeze application writes by enabling the global maintenance flag `FEATURE_FLAG_MAINTENANCE_MODE=true`.
  2. Query Neon timeline history to pinpoint the exact timestamp preceding the corruption event `T_safe`.
  3. Restore database state to `T_safe` using Neon PITR branch creation:
     ```bash
     neon branches create --parent main --timestamp "${T_safe}" --name pitr-restore-active
     ```
  4. Run schema integrity validation script: `node scripts/verify-backup.mjs --target-branch pitr-restore-active`.
  5. Promote restored branch to main connection string and disable maintenance mode.

### Scenario C: AWS S3 Resume Storage Bucket Corruption or Outage
- **Detection:** Resume downloads return HTTP 404 or S3 NoSuchBucket / AccessDenied errors.
- **Failover Action:**
  1. Point `S3_BUCKET_NAME` to the secondary replicated bucket in `ap-southeast-1`.
  2. The Cross-Region Replication (CRR) policy ensures files exist with matching object keys (`cand_<id>/<uuid>_<filename>.pdf`).
  3. Validate access permissions and presigned URL generation with `node scripts/verify-storage.mjs`.

### Scenario D: Upstash Redis Unavailability
- **Detection:** Rate limiter or cache provider throws network timeouts (`ETIMEDOUT`).
- **Automated Fallback:**
  1. Zero manual intervention required. The `RedisCacheProvider` and `RedisRateLimitStore` catch connection failures and gracefully degrade to local in-process memory stores.
  2. Alerts are dispatched to PagerDuty/Slack for SRE visibility.

---

## 5. Verification & Audit Tooling

To ensure that backups are not merely generated but proven restorable, the following automated verification tooling is integrated into the CI/CD and operational cron schedule:

1. **`scripts/verify-backup.mjs`:** Tests PostgreSQL logical dumps by spinning up a sandboxed temporary schema, validating table counts, foreign keys, and idempotency tables.
2. **`src/lib/storage/reconciliation.ts`:** Performs bidirectional reconciliation between relational `resumes` table records and S3 bucket object listings, reporting orphaned files or missing blobs.

---

## 6. Disaster Recovery Test Schedule ("Game Days")

| Activity | Frequency | Responsible Role | Verification Artifact |
| :--- | :--- | :--- | :--- |
| **Automated Backup Integrity Test** | Daily (03:00 UTC) | SRE Automation / GitHub Action | Test report in S3 + Health probe status |
| **Neon Point-in-Time Restore Simulation** | Monthly | Lead Database Reliability Engineer | Branch creation log + Diff verification |
| **Full Regional Outage Simulation (Game Day)** | Semi-annually | Cross-functional Engineering Team | Formal Post-Incident Review (PIR) |
| **Secret Rotation & Key Compromise Drill** | Quarterly | Application Security Lead | Audit log entry verifying new key active |
