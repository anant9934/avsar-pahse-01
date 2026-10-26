# AVSAR PLATFORM — OBSERVABILITY, PRODUCTION METRICS & ALERTING POLICY

**Role:** Platform Reliability, SRE & Observability Lead  
**Scope:** Telemetry Dictionary, Alert Conditions (P1–P4), Health Governance & Runbook Routing  
**Standard:** AI Tathastu Production Assurance (Phase 8)

---

## 1. PRODUCTION METRIC DICTIONARY

| Metric Name | Type | Description | Target / SLO | Aggregation Level |
|---|---|---|---|---|
| `http_requests_total` | Counter | Total incoming HTTP requests by route and status code | 100–250 RPS sustained | Edge & Serverless Aggregated |
| `http_request_duration_ms` | Histogram | Request latency with p50, p95, p99 percentiles | Public: p95 < 500ms; Auth: p95 < 700ms | APM / OpenTelemetry |
| `http_server_errors_rate` | Gauge | Ratio of HTTP 5xx responses to total requests | < 1.0% error rate | Sliding 5-minute window |
| `db_query_duration_ms` | Histogram | Database query duration across SELECT and mutations | p95 < 150ms | In-process timer + Neon APM |
| `db_pool_saturation_ratio` | Gauge | Active connections divided by pool capacity (`totalCount / poolMax`) | < 80% saturation | Per-instance + PgBouncer |
| `db_replica_lag_seconds` | Gauge | Real-time replication lag on read-replica | < 10 seconds | Periodic probe (60s) |
| `cache_hit_ratio` | Gauge | Cache hits vs (hits + misses) | > 85% for public job discovery | Process-local & Upstash global |
| `queue_durable_depth` | Gauge | Total pending jobs awaiting worker leasing in `durable_jobs` | < 500 tasks backlog | Database query count |
| `queue_dead_letter_count` | Gauge | Total exhausted jobs with `status = 'failed'` | 0 under normal operations | Database query count |
| `storage_error_total` | Counter | Failures in signed URL generation or binary upload validation | < 0.1% of upload attempts | Application logger |
| `auth_failures_total` | Counter | Rate-limited or rejected login/admin authentication attempts | Normal baseline; spikes flag brute-force | Sliding window counter |
| `ratelimit_blocks_total` | Counter | Total HTTP 429 Too Many Requests responses emitted | Baseline; spikes flag DDoS or scraper | Edge + Ingress APM |

---

## 2. ALERT CONDITIONS, SEVERITY TIERS & ESCALATION PATHS

| Severity | Alert Rule | Condition | Trigger Window | Notification Channel | Operator Action |
|---|---|---|---|---|---|
| **P1 — CRITICAL** | Database Down / Unreachable | Database readiness probe `/api/health/ready` returns 503 | 2 consecutive checks (30s) | PagerDuty / SRE On-Call Phone | Switch to read replica fallback or inspect Neon compute status; check connection limits. |
| **P1 — CRITICAL** | Elevated 5xx Error Spike | `http_server_errors_rate > 5%` | 2 minutes sustained | PagerDuty / Slack #ops-alerts | Inspect deployment logs; check recent migrations; initiate rollback if caused by release. |
| **P2 — MAJOR** | Database Pool Exhaustion | `db_pool_saturation_ratio > 90%` | 3 minutes sustained | Slack #ops-alerts | Check for long-running transactions; increase Neon pooled compute limit. |
| **P2 — MAJOR** | Queue Backlog Spike | `queue_durable_depth > 1000` | 5 minutes sustained | Slack #ops-alerts | Check worker health; scale worker pool or inspect failing job types. |
| **P2 — MAJOR** | Authentication Outage | AI Tathastu SSO token exchanges fail continuously | 3 minutes sustained | Slack #ops-alerts | Verify external SSO endpoint availability; check OAuth secret validity. |
| **P3 — MODERATE** | Dead-Letter Queue Accumulation | `queue_dead_letter_count > 50` | 15 minutes | Email / Slack #dev-ops | Run `node scripts/replay-dlq.mjs --inspect` to review failure reasons; resolve upstream issue. |
| **P3 — MODERATE** | Cache Hit Ratio Degradation | `cache_hit_ratio < 60%` | 15 minutes | Slack #dev-ops | Check Upstash Redis connectivity; inspect key expiration and stampede metrics. |
| **P4 — LOW** | Elevated Rate-Limit Blocks | HTTP 429 responses > 100 req/min | 10 minutes | Slack #bot-traffic | Inspect attacking IP / CIDR; block abusive scrapers at Cloudflare/Vercel firewall level. |

---

## 3. TRI-LEVEL HEALTH PROBE GOVERNANCE

Avsar enforces three distinct probe boundaries to prevent circular cascading failures:

1. **Liveness Probe (`GET /api/health/live`):**
   - Lightweight, unauthenticated.
   - Confirms Node.js event loop and Vercel serverless function lifecycle.
   - Never touches database or external network.
2. **Readiness Probe (`GET /api/health/ready`):**
   - Unauthenticated, bounded 2s timeout.
   - Verifies primary database and storage providers are ready to process transactions.
   - Returns 503 if primary database is down.
3. **Diagnostics Endpoint (`GET /api/health/diagnostics`):**
   - Strictly authenticated via Admin session cookie or Bearer secret.
   - Returns connection pool counters, replica lag, queue depth, dead-letter breakdown, and circuit breaker status.
