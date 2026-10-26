# Avsar by AI Tathastu — Vercel Production Deployment & Operations Runbook

This document is the authoritative engineering runbook for deploying, configuring, and maintaining **Avsar by AI Tathastu** on **Vercel**, backed by **Neon Serverless PostgreSQL** and **Durable Object Storage**.

---

## 1. Production Architecture Overview

```mermaid
graph TD
    Client[Web & Mobile Browsers] -->|HTTPS / TLS| VercelEdge[Vercel Global Edge Network]
    VercelEdge -->|Static Assets & ISR| VercelCache[Edge Cache]
    VercelEdge -->|Serverless Functions / API| NextApp[Next.js 16.4.3 App Router]

    NextApp -->|Pooled SQL Port 5432| NeonPooler[Neon Serverless PgBouncer Pooler]
    NeonPooler -->|ACID Queries| NeonCompute[Neon Primary PostgreSQL Compute]

    NextApp -->|Presigned URLs & Uploads| S3Bucket[(Private S3 / R2 Object Storage)]
    NextApp -->|OAuth 2.0 + PKCE Exchange| AITathastuIdP[AI Tathastu Identity Provider]
```

### Key Production Tenets
1. **Serverless Filesystem Ephemerality**: Vercel serverless function containers have ephemeral, read-only local storage. Candidate resumes must be stored in private object storage (AWS S3 or Cloudflare R2).
2. **Neon Connection Pooling**: All serverless connections must target Neon's PgBouncer pooler (`ep-*-pooler.[region].aws.neon.tech`) to prevent database connection exhaustion under traffic spikes.
3. **No Silent Ephemeral Fallback**: In production (`NODE_ENV=production`), the application refuses to start or accept writes if `DATABASE_URL` is unconfigured. Local JSON writes are strictly rejected.
4. **Defense in Depth**: Automatic security headers (`CSP`, `HSTS`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`), PKCE verification, and candidate data isolation are enforced.

---

## 2. Vercel Project Setup (Console Steps)

### Step 2.1: Import Git Repository
1. Navigate to the **[Vercel Dashboard](https://vercel.com/dashboard)**.
2. Click **Add New...** → **Project**.
3. Import the official GitHub repository:
   - Repository: `https://github.com/anant9934/avsar-pahse-01.git`
   - Production Branch: `main`
4. In **Framework Preset**, select **Next.js**.
5. In **Root Directory**, keep `./`.

### Step 2.2: Build and Output Settings
- **Build Command**: `npm run build` (or Next.js default `next build`)
- **Output Directory**: `.next` (Next.js default)
- **Install Command**: `npm install` or `npm ci`
- **Node.js Version**: `20.x` or `22.x` (Configured in Project Settings → General)

---

## 3. Environment Variables Configuration

Configure the following environment variables in **Project Settings → Environment Variables**. Check the appropriate environments (Production, Preview, Development).

| Variable Name | Environment | Required | Description / Format |
|---|---|---|---|
| `DATABASE_URL` | Production, Preview | **Yes** | Neon pooled endpoint: `postgresql://user:pass@ep-*-pooler.neon.tech/neondb?sslmode=require` |
| `DB_POOL_MAX` | Production | No | Max pool size per serverless container (Recommended: `5` to `10`, default `20`) |
| `STORAGE_PROVIDER` | Production | **Yes** | Set to `s3` for AWS S3, Cloudflare R2, or Supabase Storage |
| `STORAGE_BUCKET` | Production | **Yes** | Name of the private object storage bucket (e.g. `avsar-resumes-prod`) |
| `STORAGE_REGION` | Production | **Yes** | AWS/S3 datacenter region (e.g. `us-east-1` or `auto` for R2) |
| `STORAGE_ACCESS_KEY_ID` | Production | **Yes** | Server-side cloud storage access key (never use `NEXT_PUBLIC_`) |
| `STORAGE_SECRET_ACCESS_KEY` | Production | **Yes** | Server-side cloud storage secret access key |
| `STORAGE_ENDPOINT` | Production | Optional | Custom endpoint for Cloudflare R2 (`https://<account>.r2.cloudflarestorage.com`) |
| `AI_TATHASTU_CLIENT_ID` | Production, Preview | **Yes** | Registered OAuth client ID on AI Tathastu Identity Provider |
| `AI_TATHASTU_CLIENT_SECRET` | Production | **Yes** | Confidential client secret issued by AI Tathastu |
| `AI_TATHASTU_ISSUER_URL` | Production, Preview | **Yes** | `https://www.aitathastu.com` |
| `AVSAR_AUTH_REDIRECT_URI` | Production | **Yes** | `https://<your-domain>/api/auth/aitathastu/callback` |
| `AVSAR_SESSION_SECRET` | Production, Preview | **Yes** | High-entropy 32+ character HMAC key (`openssl rand -base64 32`) |
| `AVSAR_ADMIN_SECRET` | Production | **Yes** | Secret passkey for admin dashboard and job ingestion |
| `NEXT_PUBLIC_APP_URL` | Production | **Yes** | Canonical public URL (e.g. `https://avsar.ai`) for sitemap and SEO |
| `ALLOW_EPHEMERAL_LOCAL_STORAGE` | Preview | Optional | Set to `true` **only** for staging/preview PRs if S3 bucket is omitted |
| `ALLOW_DEMO_AUTH` | Preview, Dev | Optional | Set to `false` in production. Allows one-click demo login in dev. |

> [!CAUTION]
> Never expose `DATABASE_URL`, `AI_TATHASTU_CLIENT_SECRET`, or `STORAGE_SECRET_ACCESS_KEY` to client bundles via `NEXT_PUBLIC_`.

---

## 4. Pre-Deployment Database Migration Runbook

Before directing live user traffic to a new Vercel deployment, apply PostgreSQL schema migrations against the Neon production database:

### Migration Execution
1. Obtain the direct or pooled Neon connection string from [Neon Console](https://console.neon.tech/).
2. Run the migration script locally or via CI:
   ```bash
   DATABASE_URL="postgresql://user:pass@ep-*-pooler.neon.tech/neondb?sslmode=require" node scripts/migrate-to-postgres.mjs
   ```
3. Confirm output displays:
   - `[Migration] PostgreSQL schema validated/created successfully.`
   - `[Migration] Reconciliation complete: 0 errors.`
4. Verify table row counts:
   ```sql
   SELECT 'jobs' AS table_name, count(*) FROM jobs
   UNION ALL
   SELECT 'candidates', count(*) FROM candidates
   UNION ALL
   SELECT 'applications', count(*) FROM applications;
   ```

---

## 5. Post-Deployment Smoke Test Checklist

Once Vercel finishes deploying the commit:

1. **System Health Verification**:
   - Access `GET https://<your-domain>/api/health`
   - Response status must be `200 OK`
   - Verify `services.database.status === "healthy"`
   - Verify `services.database.type === "neon"` and `services.database.isPooled === true`
   - Verify `services.storage.status === "healthy"`
   - Verify `deployment.platform === "vercel"`
2. **SEO & Indexation Verification**:
   - Access `GET https://<your-domain>/robots.txt` — confirm `/admin/` and `/api/` are disallowed, sitemap is advertised.
   - Access `GET https://<your-domain>/sitemap.xml` — confirm XML sitemap lists active job postings and core pages.
3. **Security Headers Verification**:
   - Inspect response headers on any page:
     ```bash
     curl -I https://<your-domain>/
     ```
   - Verify `X-Frame-Options: DENY`
   - Verify `X-Content-Type-Options: nosniff`
   - Verify `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
   - Verify `x-powered-by` header is completely suppressed.
4. **Candidate Journey Smoke Test**:
   - Load Landing Page (`/`) and Welcome Page (`/welcome`).
   - Search & Filter Jobs (`/explore`) with pagination.
   - View Job Detail (`/jobs/<id>`).
   - Authenticate with AI Tathastu SSO (`/api/auth/aitathastu/login`).
   - View Candidate Profile (`/profile`).
   - Save and Unsave Job (`POST /api/jobs/saved`).
   - Submit Application (`POST /api/applications`).
   - Verify duplicate application rejection.
5. **Error Boundary & 404 Smoke Test**:
   - Visit an invalid URL (e.g. `/nonexistent-route`) — verify branded Avsar 404 page renders with "Go to Home" and "Explore Jobs" links.

---

## 6. Rollback & Disaster Recovery Procedures

### Instant Vercel Rollback (Frontend / Serverless Code)
1. Go to **Vercel Dashboard** → **Deployments**.
2. Identify the last known good deployment.
3. Click the three dots (`...`) → **Instant Rollback**.
4. Traffic will switch to the prior immutable build artifact within seconds.

### Database Recovery Protocol
1. **Zero-Copy Point-In-Time Restore (Neon)**:
   - Neon maintains continuous WAL-based point-in-time recovery (PITR).
   - In Neon Console, click **Branches** → **Create Branch from Point in Time**.
   - Select the timestamp immediately preceding the incident.
   - Test the branch, then update `DATABASE_URL` in Vercel to point to the restored branch.
2. **Rule on Database Backups**:
   - Never blindly restore a cold database snapshot over an active production database if new candidate applications or bookmarks have been written.
   - Schema changes must always be backward-compatible (expand-and-contract pattern: add nullable columns first, deploy code, then enforce constraints).

---

## 7. Operational Incident Runbook

| Incident | Root Cause | Immediate Action |
|---|---|---|
| `/api/health` returns HTTP 503 | `DATABASE_URL` missing or Neon compute paused | Check Neon Console compute status; verify Vercel `DATABASE_URL` environment variable |
| Resume upload returns HTTP 500 | `STORAGE_BUCKET` or S3 credentials misconfigured | Verify AWS/R2 credentials in Vercel Project Settings; check bucket policy |
| OAuth returns `redirect_uri_mismatch` | Domain mismatch between Vercel and AI Tathastu IdP | Set `AVSAR_AUTH_REDIRECT_URI=https://<your-domain>/api/auth/aitathastu/callback` in Vercel |
| Neon `too many clients` error | Non-pooled connection string configured | Ensure `DATABASE_URL` host contains `-pooler.` and port is `5432` |
