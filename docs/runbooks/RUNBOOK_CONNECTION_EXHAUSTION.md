# SRE OPERATIONAL RUNBOOK: POSTGRESQL CONNECTION POOL EXHAUSTION

**Severity:** P2 — High (Degraded Performance / Latency Spikes)  
**Target Service:** PostgreSQL Connection Pool (`pg.Pool`) & Neon PgBouncer  
**SLO Impact:** P95/P99 latency spikes > 2,000ms; client checkout timeouts  
**Owner:** Database Reliability Engineer (DBRE) / Platform SRE  

---

## 1. Symptoms & Incident Detection

PostgreSQL connection exhaustion is diagnosed when:
1. Application logs display:
   - `53300: too many connections`
   - `remaining connection slots are reserved for non-replication superuser connections`
   - `timeout exceeded when connecting to database` (checkout timeout)
2. Restricted diagnostics endpoint `/api/health/diagnostics` reports:
   - `diagnostics.database.pool.waitingCount > 5`
   - `diagnostics.database.pool.idleCount === 0`
   - `diagnostics.database.pool.totalCount === max`
3. Neon console indicates compute connection count has reached 100% of allocated capacity.

---

## 2. Immediate Containment & Mitigation (T+0 to T+5 minutes)

### Step 1: Verify Connection Mode (Pooled vs Direct)
Neon provides two connection modes:
- **Pooled (Port 6543):** Uses PgBouncer transaction-mode pooling. Required for serverless Next.js functions.
- **Direct (Port 5432):** Direct session connection to PostgreSQL. Only permissible for schema migrations (`migrator.ts`).

Inspect `POSTGRES_URL` in production:
```bash
# If the connection string contains '-pooler' or port 6543, pooling is active.
# If connecting directly to port 5432, immediately switch to pooled endpoint:
vercel env add POSTGRES_URL "postgres://user:pass@ep-cool-xyz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" production
```

### Step 2: Terminate Idle-In-Transaction and Hanging Queries
From a database console (Neon SQL Editor or psql):
```sql
-- 1. Identify long-running and idle-in-transaction connections
SELECT pid, 
       now() - pg_stat_activity.query_start AS duration, 
       query, 
       state 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '10 seconds'
  AND state != 'idle';

-- 2. Terminate idle-in-transaction backends holding locks
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND (now() - state_change) > interval '5 seconds';
```

---

## 3. Root Cause Investigation

1. **Connection Leaks in Serverless Functions:**
   - Verify that all `pool.connect()` calls have matching `client.release()` calls in strict `try ... finally` blocks.
   - Example fix in code:
     ```typescript
     const client = await pool.connect();
     try {
       // execute queries
     } finally {
       client.release(); // MANDATORY: Must never be omitted
     }
     ```
2. **Neon Concurrency Spikes:**
   - Under heavy incoming traffic (e.g., campus recruitment drive), multiple serverless function instances may spin up concurrently.
   - Adjust `POSTGRES_POOL_MAX` in serverless environments to `1` or `2` connections per instance:
     ```bash
     vercel env add POSTGRES_POOL_MAX 2 production
     ```
   - This prevents 100 serverless functions from attempting to open 10 connections each (1,000 connections total), keeping aggregate connections within Neon's limits.

---

## 4. Verification & Health Audit

1. **Inspect Pool Saturation via Diagnostics:**
   ```bash
   curl -s -H "x-admin-key: $AVSAR_ADMIN_SECRET" https://avsar.aitathastu.org/api/health/diagnostics | jq '.diagnostics.database.pool'
   ```
   *Expected:* `waitingCount: 0`, healthy balance between `idleCount` and `totalCount`.
2. **Execute Database Concurrency Test:**
   ```bash
   npm test test/database-storage.test.mjs
   ```
3. **Verify API Latency Normalization:** Confirm P95 latency returns to < 200ms on `/api/jobs` and `/api/applications`.
