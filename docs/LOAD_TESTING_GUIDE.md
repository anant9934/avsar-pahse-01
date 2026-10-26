# Avsar by AI Tathastu — High Concurrency Load Testing Guide

This guide details the methodology, workload profiles, execution runbooks, and acceptance criteria for validating **Avsar by AI Tathastu** under sustained **1,000 concurrent active users**.

---

## 1. Load Test Workload Profile

The benchmark simulates realistic human interactions inspired by campus hiring drives and high-volume career platforms.

```
       Concurrent Users (CCU)
  1000 |                  _________________________ (Sustained 15m)
       |                 /                         \
   500 |                /                           \
       |   (Warm-up)   /                             \ (Cooldown)
     0 |______________/                               \_____________
       0m            3m                            18m           20m
```

### Profile Specification
- **Target CCU:** 1,000 simultaneous active virtual users.
- **Ramp-Up:** 0 to 1,000 virtual users over 3 minutes (gradual ramp to avoid cold-start connection storms).
- **Sustained Load:** 1,000 virtual users sustained for 15 minutes.
- **Cooldown:** 1,000 to 0 virtual users over 2 minutes.
- **User Think Time:** 8 to 12 seconds randomized normal distribution.
- **Simulated Request Rate:** 100 to 125 requests/second average, peaking at 200 RPS during search bursts.

---

## 2. Simulated User Journeys

The benchmark distributes traffic across 8 distinct user journeys:

| Journey Name | Weight | Primary Endpoints | Operations |
|---|---|---|---|
| **J1: Public Job Browsing** | 35% | `GET /`, `GET /explore`, `GET /home` | Loads static & dynamic landing pages |
| **J2: Search & Filter Queries** | 25% | `GET /api/jobs?q=...&category=...` | Bounded pagination, full-text search |
| **J3: Job Detail & Eligibility** | 15% | `GET /api/jobs/[id]`, `/jobs/[id]/match` | Job requirements, skill matching breakdown |
| **J4: Authenticated Profile** | 10% | `GET /api/profile`, `GET /api/auth/session` | Resolves authenticated candidate profile |
| **J5: Job Bookmarking** | 5% | `POST /api/jobs/saved` | Toggles saved jobs with optimistic feedback |
| **J6: Application Submission** | 5% | `POST /api/applications` | Submits candidate questionnaire & resume ID |
| **J7: Resume Metadata** | 3% | `GET /api/resumes`, `POST /api/resumes` | Queries uploaded resume list |
| **J8: Health & Monitoring** | 2% | `GET /api/health`, `GET /api/metrics` | System telemetry & readiness verification |

---

## 3. SLA Acceptance Criteria

| Metric | Target SLA | Hard Failure Boundary |
|---|---|---|
| **Public Read API p95 Latency** | $< 350\text{ ms}$ | $> 500\text{ ms}$ |
| **Authenticated Read API p95 Latency** | $< 450\text{ ms}$ | $> 700\text{ ms}$ |
| **Application Write API p95 Latency** | $< 650\text{ ms}$ | $> 1,000\text{ ms}$ |
| **Overall Error Rate (5xx)** | $< 0.1\%$ | $> 1.0\%$ |
| **Database Pool Exhaustion** | 0 timeouts | $> 0$ unhandled pool drops |
| **Data Isolation Breaches** | **0 leaks** | Any horizontal data exposure |
| **Duplicate Applications** | **0 duplicates** | Any duplicate application record |

---

## 4. Execution Runbook

### Step 4.1: Seed Synthetic Load Test Data
To protect production integrity, load tests must run against synthetic candidate and job datasets:
```bash
node scripts/generate-synthetic-load-data.mjs --count 500
```

### Step 4.2: Execute Benchmark Suite
Run the built-in high-concurrency benchmark runner:
```bash
# Run local 1,000 CCU simulation
node scripts/load-test.mjs --users 1000 --duration 900s --rampup 180s --target http://localhost:3000
```

### Step 4.3: Inspect Telemetry & Post-Test Verification
1. Access `GET /api/metrics` (with admin secret) to inspect p50, p95, p99 latencies and cache hit ratios.
2. Access `GET /api/health` to confirm database pool recovery and memory stability.
3. Verify zero duplicate applications:
   ```sql
   SELECT candidate_id, job_id, COUNT(*)
   FROM applications
   GROUP BY candidate_id, job_id
   HAVING COUNT(*) > 1;
   ```
