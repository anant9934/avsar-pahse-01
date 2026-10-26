# AVSAR BY AI TATHASTU — ENTERPRISE CONCURRENCY & RELIABILITY RUNBOOK

This operational runbook provides production engineering procedures for maintaining high availability, resilience, and sub-second latency across **Avsar by AI Tathastu** under sustained enterprise concurrency (5,000–8,000 registered candidates, ~1,000 active concurrent users, 100–250 RPS).

---

## 1. Architecture Topology & Flow

```
[ ~1,000 Concurrent Candidates ]
               │
               ▼
   [ Vercel Edge Global CDN ]
   - HTTP/3, TLS 1.3 Termination
   - Cache-Control: s-maxage=60, stale-while-revalidate=120
   - RFC Weak ETag 304 Not Modified Evaluation
               │
               ▼
[ Next.js Serverless Function Runtime ]
   ├── Distributed Rate Limiting (Sliding Window Log, Candidate-Scoping)
   ├── Caching Subsystem (LRU + Singleflight Stampede Defense + Redis REST)
   ├── Inverted Index Search Accelerator (O(1) Keyword & Skill Lookup)
   ├── Telemetry Profiler (W3C TraceContext + Microsecond Server-Timing)
   └── Adaptive Load Shedder (Priority Degradation: critical / standard / low)
               │
      ┌────────┴────────┐
      ▼                 ▼
[ Neon PgBouncer ]   [ Upstash Redis ]   [ Asynchronous Queue Workers ]
- Write Primary      - Distributed Lock  - Exponential Backoff Retries
- Read Replica Pool  - Multi-node State  - Dead Letter Queue (DLQ)
```

---

## 2. Key Operational Thresholds & SLAs

| Metric | Target SLA | Degraded Trigger | Critical Trigger |
| :--- | :--- | :--- | :--- |
| **API P50 Latency** | < 45 ms | > 100 ms | > 300 ms |
| **API P95 Latency** | < 250 ms | > 500 ms | > 1,500 ms |
| **API P99 Latency** | < 500 ms | > 1,000 ms | > 3,000 ms |
| **Edge Cache Hit Ratio** | > 85% | < 70% | < 50% |
| **Error Rate (5xx)** | < 0.1% | > 1.0% | > 5.0% |
| **DB Active Connections** | 5–15 | 20–25 | > 30 (exhaustion) |

---

## 3. Incident Triage Runbooks

### Incident 1: Database Connection Pool Saturation
**Symptoms:** `DatabaseUnavailableError: timeout exceeded when connecting to database` or 503 responses on `/api/jobs`.
1. **Verify Endpoint Configuration**:
   Ensure `DATABASE_URL` targets the Neon connection pooler:
   ```bash
   # Hostname must include -pooler
   echo $DATABASE_URL | grep "\-pooler\."
   ```
2. **Inspect Active Connection Count**:
   Query Neon metrics or run:
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```
3. **Engage Read Replica**:
   Verify `POSTGRES_READ_URL` is set to route 95% of read queries to the replica pool:
   ```bash
   export POSTGRES_READ_URL="postgres://user:pass@ep-read-replica-pooler.neon.tech/avsar"
   ```

---

### Incident 2: Circuit Breaker Tripped (`neon_db` or `oauth_idp`)
**Symptoms:** Requests fail immediately with `CircuitBreakerOpenError: Circuit neon_db is OPEN`.
1. **Check Real-Time Circuit Status via Health API**:
   ```bash
   curl -s https://<domain>/api/health | jq .circuitBreakers
   ```
2. **Inspect Breaker Metrics**:
   - `consecutiveFailures`: Number of consecutive timeouts or connection errors.
   - `state`: `OPEN` (fast-failing) or `HALF_OPEN` (probing upstream).
3. **Recovery Verification**:
   The circuit breaker automatically probes upstream recovery after `resetTimeoutMs` (30,000ms).
   Once upstream is healthy, the breaker resets to `CLOSED`.

---

### Incident 3: Rate Limiting Throttling Storms (NAT IP Collision)
**Symptoms:** Candidates from universities or offices report unexpected `429 Too Many Requests`.
1. **Diagnosis**:
   Inspect the rate limit log. Check whether shared corporate/campus NAT IPs are exhausting anonymous rate limits.
2. **Resolution**:
   Candidate-scoped rate limiting is automatically applied when candidates authenticate.
   Instruct candidates to sign in via AI Tathastu SSO, which scopes the sliding window to their unique `candidateId` rather than public IPv4/IPv6 address.

---

### Incident 4: Asynchronous Dead Letter Queue (DLQ) Recovery
**Symptoms:** Background jobs fail retries and enter DLQ.
1. **Inspect DLQ Status**:
   ```bash
   curl -s https://<domain>/api/health | jq .queueStats
   ```
2. **Triage Poison Messages**:
   Inspect the `failedReason` field on the failed job payload.
3. **Re-Enqueue Recovered Jobs**:
   Once root cause (e.g., third-party webhook outage or schema mismatch) is resolved, trigger DLQ re-processing.

---

### Incident 5: Adaptive Load Shedding Activation
**Symptoms:** Telemetry indicates `LoadSheddingError` on background analytical tasks.
1. **Behavior**:
   The `LoadShedder` intentionally drops low-priority background calculations (e.g., non-critical match score recalculations) when concurrency exceeds 75% of maximum capacity.
2. **Impact**:
   Critical candidate flows (OAuth authentication, resume uploads, and job application submissions) are guaranteed dedicated capacity and zero degradation.
3. **Resolution**:
   As concurrent spikes subside, `LoadShedder` automatically re-admits standard and low-priority tasks without manual intervention.

---

## 4. Verification & Synthetic Load Testing

Run the high-concurrency simulation suite to verify system readiness:
```bash
# 1. Full Unit & Concurrency Test Suite
npm test

# 2. Synthetic Load Generator (5,000 Candidates, 500 Jobs)
node scripts/generate-synthetic-load-data.mjs

# 3. High-Concurrency Percentile Benchmark (1,000 Virtual Candidates)
node scripts/load-test.mjs --target http://localhost:3000 --concurrency 50 --requests 1000
```
