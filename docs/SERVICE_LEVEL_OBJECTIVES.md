# AVSAR BY AI TATHASTU — SERVICE LEVEL OBJECTIVES (SLOs) & ERROR BUDGETS

**Document Version:** 1.0.0 (Phase 8 Production Assurance)  
**Target Scale:** 5,000–8,000 registered users, ~1,000 active concurrent users, 100–250 RPS  
**Measurement Window:** 30 rolling calendar days  

---

## 1. Service Level Indicators (SLIs) & Objectives

| Objective Name | Target Metric | Target SLO | Measurement Method | Alert Threshold |
| :--- | :--- | :--- | :--- | :--- |
| **Public Read Latency** | `GET /api/jobs`, `GET /api/jobs/[id]` | **P95 < 250 ms**<br>P99 < 500 ms | W3C Server-Timing & Edge Logs | P95 > 400 ms for 5 min |
| **Authenticated Read Latency** | `GET /api/profile`, `GET /api/applications` | **P95 < 400 ms**<br>P99 < 700 ms | W3C Server-Timing & Edge Logs | P95 > 600 ms for 5 min |
| **Application Write Latency** | `POST /api/applications` | **P95 < 500 ms**<br>P99 < 1,000 ms | Server-side transaction span | P95 > 900 ms for 3 min |
| **System Availability** | Ratio of non-5xx responses | **99.9%** | Total successful / total requests | Availability < 99.5% in 5 min |
| **Uncaught Error Rate** | HTTP 500 / 502 / 503 / 504 | **< 0.1%** | Error rate ratio | Error rate > 0.5% in 5 min |
| **Data Integrity: Deduplication** | Duplicate application records | **0.00% (Zero Tolerance)** | Database unique constraint audits | Any duplicate detected |
| **Durable Task Delivery** | Acknowledged queue task loss | **0.00% (Zero Tolerance)** | Outbox & transactional queue logs | Any missing event |
| **Database Pool Saturation** | Active / Max pooled connections | **< 75% peak** | PgBouncer / Neon metrics | Active connections > 80% |
| **Edge Cache Hit Ratio** | Public job discovery queries | **> 85%** | Edge header telemetry | Cache hit ratio < 70% |

---

## 2. Component Span vs End-to-End Latency Definitions

To avoid ambiguity, latencies are strictly categorized:
1. **End-to-End Latency ($T_{e2e}$):** Measured at the Edge CDN entry point, including DNS lookup, TLS handshake, edge caching, serverless execution, and network transfer back to client.
2. **Server Runtime Duration ($T_{server}$):** Measured inside the Next.js runtime from request receipt to response return (reported via `Server-Timing: dur=...`).
3. **Database Query Span ($T_{db}$):** Measured by the PostgreSQL client driver covering network roundtrip and query execution in Neon (`Server-Timing: db;dur=...`).
4. **Cache Span ($T_{cache}$):** Measured by the cache manager (`Server-Timing: cache;dur=...`).

---

## 3. Error Budget Policy

- An availability target of **99.9%** permits an error budget of **0.1%** of total requests over a rolling 30-day window (approx. 43.8 minutes of downtime or 1 in 1,000 failed requests).
- **Burn Rate Triggers:**
  - **1x Burn Rate:** Normal consumption. Monitored via weekly review.
  - **6x Burn Rate (5% budget consumed in 6 hours):** Low-severity notification to on-call engineer.
  - **14.4x Burn Rate (10% budget consumed in 1 hour):** High-severity page to on-call engineer; initiates automated triage.
- **Error Budget Exhaustion Action:** When error budget is exhausted (> 100%), all non-critical feature deployments are frozen until system reliability is restored and post-mortem mitigations are merged.
