# AVSAR BY AI TATHASTU — ARCHITECTURE DEPENDENCY MAP & SYSTEM AUDIT

**Phase:** Phase 8 Enterprise Production Assurance  
**Last Verified:** October 2026  
**Target Scale:** 5,000–8,000 registered users, ~1,000 active concurrent users  

---

## 1. System Dependency Matrix

| Subsystem | Owner / Module | Topology | Durability | Dependencies | Failure Modes | Test Coverage | Production State |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Edge CDN & Routing** | Vercel Edge / Next.js | Distributed | Stateless | Vercel Edge Network | DNS outage, edge proxy timeout | `vercel-deployment.test.mjs` | **VERIFIED** on Vercel |
| **API Runtime** | Next.js Serverless Functions | Multi-Instance | Stateless | Node.js 20+ runtime | Cold start latency, function timeout | Integration tests | **VERIFIED** |
| **Primary Database** | `src/lib/db/postgres.ts` | Managed (Neon) | Durable ACID | PostgreSQL 16+ via PgBouncer | Connection exhaustion, statement timeout | `neon-postgres.test.mjs`, `db-concurrency.test.mjs` | **VERIFIED** |
| **Read Replica Routing** | `src/lib/db/read-replica.ts` | Managed (Neon / AWS) | Read-only | `POSTGRES_READ_URL` | Replication lag, stale read | `read-replica.test.mjs` | **PREPARED** (Falls back to primary) |
| **Caching Tier (Memory)** | `src/lib/cache/memory-cache.ts` | Process-Local | Ephemeral | Node.js Heap | Process restart, cache divergence | `cache.test.mjs` | **VERIFIED** (Non-authoritative) |
| **Caching Tier (Redis)** | `src/lib/cache/redis-provider.ts` | Distributed | Semi-Durable | Upstash Redis REST API | Network partition, quota exhaustion | `cache.test.mjs` | **PREPARED** (Falls back to memory) |
| **Rate Limiter (Memory)** | `src/lib/ratelimit/sliding-window.ts` | Process-Local | Ephemeral | Local Memory Map | Per-instance counter isolation | `rate-limiter-distributed.test.mjs` | **VERIFIED** |
| **Rate Limiter (Redis)** | `src/lib/ratelimit/redis-limiter.ts` | Distributed | Ephemeral TTL | Upstash Redis | Connection failure | Planned Phase 8 | **PLANNED** |
| **Background Queue (Mem)** | `src/lib/queue/memory-queue.ts` | Process-Local | Non-Durable | Event Loop Microtasks | Serverless termination / job loss | `queue.test.mjs` | **VERIFIED** (Non-critical only) |
| **Durable Task Queue** | `src/lib/queue/postgres-queue.ts` | Distributed | Durable (Postgres) | PostgreSQL `SKIP LOCKED` | DB failure | Planned Phase 8 | **PLANNED** |
| **Authentication & SSO** | `src/lib/auth/aitathastu.ts` | Federated | Durable (JWT/DB) | AI Tathastu OAuth 2.0 / OIDC | Identity provider downtime | `security.test.mjs` | **VERIFIED** (Mock fallback in dev) |
| **Resume Storage** | `src/lib/storage/index.ts` | Distributed | Durable (S3/R2) | AWS S3 / Cloudflare R2 | S3 outage, presigned URL expiry | `database-storage.test.mjs` | **VERIFIED** |
| **Circuit Breakers** | `src/lib/circuit-breaker/` | Process-Local | Ephemeral | In-memory state machine | Node restart resets breaker counters | `circuit-breaker.test.mjs` | **VERIFIED** |
| **Load Shedder** | `src/lib/circuit-breaker/load-shedder.ts` | Process-Local | Ephemeral | In-flight request counter | Uncoordinated shedding | `load-shedder.test.mjs` | **VERIFIED** |
| **Search Inverted Index** | `src/lib/search/inverted-index.ts` | Process-Local | In-Memory Cache | Seeded from Job Repository | Divergence from DB after mutations | `inverted-index.test.mjs` | **VERIFIED** (Falls back to DB) |
| **Telemetry & Metrics** | `src/lib/telemetry/` | Process-Local | Ephemeral | Microsecond performance timer | Serverless metrics reset per invocation | `telemetry.test.mjs` | **VERIFIED** (Server-Timing exported) |

---

## 2. In-Depth Architectural Risk Audit

### Risk 1: Process-Local Memory Cache Divergence
- **Current Behavior:** The `MemoryCacheProvider` stores cached jobs and metrics in the process heap. Across multiple concurrent Vercel serverless function instances, instance A may hold a stale cache while instance B received a purge event.
- **Remediation Strategy:**
  1. Treat in-memory caching strictly as an unauthoritative, short-lived performance shield (max TTL: 60s).
  2. Implement distributed cache key versioning (`cache:v1:jobs`) and Upstash Redis REST invalidation bus for cross-instance consistency.
  3. Never cache authenticated candidate profile data or private application state in shared or public keys.

### Risk 2: Process-Local Background Queue Ephemerality
- **Current Behavior:** `MemoryQueue` processes asynchronous tasks (audit logging, recommendation recalculations) in-memory using `queueMicrotask` and `setTimeout`. When a Vercel serverless function finishes responding to HTTP, the execution environment may freeze or shut down, potentially losing pending or retrying jobs.
- **Remediation Strategy:**
  1. Acknowledge memory queues as valid **only** for non-critical, opportunistic workloads.
  2. Introduce a **Transactional PostgreSQL Queue** (`PostgresQueueProvider`) utilizing `SELECT ... FOR UPDATE SKIP LOCKED` for critical events (audit logs, application notifications).
  3. Implement the **Transactional Outbox Pattern** so that domain changes (e.g., job applications) and event emissions commit in the same ACID transaction.

### Risk 3: Read-Replica Consistency & Lag Realism
- **Current Behavior:** `read-replica.ts` inspects `POSTGRES_READ_URL`. If present, it pools reads separately and falls back to primary on error.
- **Remediation Strategy:**
  1. If `POSTGRES_READ_URL` is unset, the system must explicitly report dedicated replica as `unavailable` rather than implying HA.
  2. Implement **Read-After-Write Consistency Guarantee**: following any mutation (profile update, job save, application submission), immediately subsequent reads by the same candidate must be pinned to the primary database for at least 5 seconds to prevent stale replica reads.

### Risk 4: Process-Local vs Distributed Rate Limiting
- **Current Behavior:** `SlidingWindowLimiter` stores timestamps in a local `Map`. While candidate-scoped to prevent NAT collisions, a distributed attack across 10 Vercel instances allows 10x the intended limit.
- **Remediation Strategy:**
  1. Introduce `RedisSlidingWindowRateLimiter` utilizing Upstash Redis atomic pipelines (`ZREMRANGEBYSCORE`, `ZADD`, `ZCARD`, `EXPIRE`).
  2. Provide graceful local fallback with explicit logging if Redis is unreachable.

### Risk 5: Process-Local Telemetry vs Aggregated Observability
- **Current Behavior:** Percentile calculations in `metrics.ts` aggregate per serverless container.
- **Remediation Strategy:**
  1. Clearly label `/api/health` percentile figures as instance-level diagnostic measurements.
  2. Emit standard W3C `Server-Timing` headers on all responses so Edge proxies and APM solutions can aggregate true distributed global percentiles.

### Risk 6: Search Index Invalidation Consistency
- **Current Behavior:** Inverted index is in-memory. If jobs are updated in PostgreSQL, memory index may diverge.
- **Remediation Strategy:**
  1. Automatically update or invalidate the inverted index entry upon administrative job edits or bulk imports.
  2. Maintain PostgreSQL full-text search capability as the authoritative, fallback source of truth.
