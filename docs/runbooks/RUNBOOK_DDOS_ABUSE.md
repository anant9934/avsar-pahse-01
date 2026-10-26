# SRE OPERATIONAL RUNBOOK: DDOS MITIGATION & TRAFFIC ABUSE DEFENSE

**Severity:** P1 (Volumetric DDoS) / P2 (Distributed Scraping / Credential Stuffing)  
**Target Service:** Edge Network / Next.js API Routes / Rate Limiter  
**SLO Impact:** Service availability degradation, 429 rate limit errors, origin bandwidth spikes  
**Owner:** Application Security Lead (AppSec) / Platform SRE  

---

## 1. Symptoms & Incident Classification

An abuse or DDoS incident is detected by:
1. Origin request volume spikes from normal baseline (~100–250 RPS) to > 1,500 RPS without a scheduled platform event.
2. HTTP 429 ("Too Many Requests") error rate exceeds 5% of total edge traffic.
3. Elevated CPU and execution duration on search API (`/api/jobs`) or auth endpoints (`/api/auth/admin`, `/api/applications`).

### 1.1 Critical Discrimination: Campus NAT vs Malicious Botnets

| Dimension | University Campus NAT Traffic | Malicious Distributed Botnet |
| :--- | :--- | :--- |
| **Origin IP** | Single or few educational IPs (e.g. National Knowledge Network / ERNET) | Hundreds or thousands of residential / cloud hosting IPs |
| **Candidate Session** | Authenticated candidate tokens present (`cand_<id>`) | Anonymous, forged tokens, or rapidly cycling invalid sessions |
| **User-Agent** | Real mobile/desktop browser agents (Chrome, Safari, Firefox) | Headless browsers (Puppeteer, Playwright, curl, python-requests) |
| **Action** | **NEVER BLOCK ENTIRE IP!** Rely on candidate-scoped limits (`cand:<id>`). | **BLOCK AT EDGE.** Challenge or block via WAF and IP rules. |

---

## 2. Immediate Containment Workflow (T+0 to T+5 minutes)

### Step 1: Deploy Edge WAF Challenge (Vercel / Cloudflare)
1. Navigate to Vercel Firewall / Cloudflare Security Settings.
2. Enable **Managed Challenge** for:
   - Requests with missing or suspicious `User-Agent`.
   - Requests from cloud provider ASNs (DigitalOcean, Hetzner, OVH, AWS EC2) targeting recruitment endpoints.
   - Example expression:
     ```
     (ip.geoip.asnum in {14061 16276 24940 16509} and http.request.uri.path contains "/api/")
     ```

### Step 2: Tighten Platform Rate Limits via Environment Variables
Temporarily reduce rate limit thresholds for unauthenticated visitors:
```bash
# Reduce unauthenticated search requests from 60 to 20 per minute
vercel env add RATE_LIMIT_SEARCH_MAX_REQUESTS 20 production

# Reduce application submissions per IP to 5 per minute
vercel env add RATE_LIMIT_APPLY_MAX_REQUESTS 5 production

# Enable global sliding window limiter enforcement
vercel env add RATE_LIMIT_GLOBAL_ENABLED true production
```

### Step 3: Protect Admin Login Endpoints
If `/api/auth/admin` is experiencing credential stuffing:
1. Verify constant-time comparison is active (preventing timing attacks).
2. Tighten admin sliding-window limit to 3 attempts per 15 minutes.
3. Restrict admin route access to SRE VPN / bastion IPs in Vercel Firewall rules.

---

## 3. Root Cause Analysis & Traffic Tracing

1. **Inspect Audit Log Stream:**
   Query `audit_events` table for recent high-frequency failed attempts:
   ```sql
   SELECT ip_address, action, count(*) AS attempts
   FROM audit_events
   WHERE created_at > NOW() - INTERVAL '15 minutes'
   GROUP BY ip_address, action
   ORDER BY attempts DESC
   LIMIT 20;
   ```
2. **Review Rate Limiter Scope Headers:**
   Inspect edge response headers:
   - `X-RateLimit-Scope: candidate` -> Legitimate candidate traffic.
   - `X-RateLimit-Scope: ip` -> Anonymous caller.
   - `X-RateLimit-Remaining: 0` -> Threshold reached.

---

## 4. Recovery Validation

1. Verify origin CPU and database pool saturation drop back to nominal ranges.
2. Confirm that legitimate candidates from university campuses can search and apply without receiving 429 errors.
3. Run test suite:
   ```bash
   npm test test/rate-limiter-distributed.test.mjs test/trusted-proxies.test.mjs
   ```
4. Restore standard rate limit thresholds once attack subsides.
