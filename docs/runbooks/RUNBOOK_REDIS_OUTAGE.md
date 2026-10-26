# SRE OPERATIONAL RUNBOOK: REDIS OUTAGE & CACHE DEGRADATION

**Severity:** P2 — High (Performance Degradation / Cold-Cache Load)  
**Target Service:** Upstash Redis / Distributed Cache Provider / Rate Limiting Store  
**SLO Impact:** Increased P95 API read latency (from < 50ms to ~150ms); higher primary DB query volume  
**Owner:** Cache Reliability Engineer / Platform SRE  

---

## 1. Symptoms & Incident Detection

An active Redis outage is diagnosed when:
1. Application logs report Redis REST communication failures:
   - `[Redis Cache] Operation failed, falling back to local store: fetch failed`
   - `[RateLimiter] Redis store unreachable: ETIMEDOUT`
2. Upstash service status reports regional degradation or downtime.
3. Database read queries on `jobs` table surge from normal ~20 RPS to > 150 RPS.
4. Circuit breaker `redis_cache_circuit` transitions to `OPEN`.

---

## 2. Automated System Resilience (Design Verification)

The Avsar platform is engineered for zero-downtime survival during complete Redis unavailability:
1. **In-Memory Fallback:** `RedisCacheProvider` automatically intercepts network errors and routes requests to the local LRU cache without throwing exceptions to end users.
2. **Singleflight Stampede Protection:** Concurrent requests for the same uncached job ID or search filter query are coalesced into a single PostgreSQL execution, preventing thundering herds from crashing the database.
3. **In-Memory Rate Limiting Fallback:** `checkRateLimit` switches seamlessly to in-process sliding window counters to maintain brute-force protection.

---

## 3. Operational Triage & Mitigations (T+0 to T+5 minutes)

### Step 1: Verify Database Load & Read Replica Offloading
During a Redis outage, all cache misses fall through to PostgreSQL:
1. Query database pool saturation:
   ```bash
   curl -s -H "x-admin-key: $AVSAR_ADMIN_SECRET" https://avsar.aitathastu.org/api/health/diagnostics | jq '.diagnostics.database'
   ```
2. Verify that `checkReplicationLag()` indicates read replica is healthy (`healthy: true`).
3. If primary database CPU exceeds 75%, ensure `shouldRouteToPrimary()` is only routing recent mutators and anonymous search reads are offloaded to read replica.

### Step 2: Validate Upstash Credentials and Quotas
1. Log in to Upstash Console (`https://console.upstash.com`).
2. Verify that monthly request quota has not been exceeded.
3. If quota was exceeded, upgrade bandwidth tier or update credentials in Vercel:
   ```bash
   vercel env add UPSTASH_REDIS_REST_URL "https://new-endpoint.upstash.io" production
   vercel env add UPSTASH_REDIS_REST_TOKEN "new-token" production
   ```

---

## 4. Post-Restoration Cache Warming & Recovery

Once Upstash Redis connectivity is restored:
1. Verify that `RedisCacheProvider` auto-recovers and begins persisting entries.
2. **Execute Controlled Cache Warming:**
   Run warm-up script to pre-populate top job search filters and active postings:
   ```bash
   curl -s "https://avsar.aitathastu.org/api/jobs?limit=50" > /dev/null
   curl -s "https://avsar.aitathastu.org/api/jobs?workArrangement=Remote" > /dev/null
   curl -s "https://avsar.aitathastu.org/api/jobs?workArrangement=Hybrid" > /dev/null
   curl -s "https://avsar.aitathastu.org/api/jobs?category=Software+Development" > /dev/null
   ```
3. **Verify Cache Stats via Diagnostics Endpoint:**
   ```bash
   curl -s -H "x-admin-key: $AVSAR_ADMIN_SECRET" https://avsar.aitathastu.org/api/health/diagnostics | jq '.diagnostics.cache'
   ```
   *Expected:* Cache hits start climbing, hit ratio returns to > 70%.
4. **Run Cache Regression Test Suite:**
   ```bash
   npm test test/cache.test.mjs test/redis-provider.test.mjs test/key-generator.test.mjs
   ```
