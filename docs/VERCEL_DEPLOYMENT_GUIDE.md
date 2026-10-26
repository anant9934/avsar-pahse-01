# AVSAR BY AI TATHASTU — VERCEL PRODUCTION DEPLOYMENT & NEON DATABASE GUIDE

This operational runbook provides the verified, comprehensive deployment specification for launching **Avsar by AI Tathastu** on **Vercel** with **Neon Serverless PostgreSQL**.

---

## 1. Verified Target Domains

| Purpose | Canonical URL | DNS / Routing Configuration |
| :--- | :--- | :--- |
| **Primary Custom Domain** | `https://avsar.aitathastu.com/` | CNAME record pointing to `cname.vercel-dns.com` |
| **Vercel Default Domain** | `https://avsar-pahse-01.vercel.app/` | Automatic HTTPS routing by Vercel edge network |

---

## 2. Neon Serverless PostgreSQL Configuration

Avsar is fully integrated with Neon Serverless PostgreSQL. In serverless edge and Node.js runtime environments (such as Vercel Functions), connection pooling is mandatory to prevent TCP socket exhaustion.

### Dual Endpoints Architecture:

1. **Pooled Connection (Mandatory for Runtime Compute & Lambdas):**
   - **Endpoint:** `ep-dawn-bread-b43uywng-pooler.c-6.us-east-2.aws.neon.tech`
   - **Environment Variables:** `DATABASE_URL` and `POSTGRES_URL`
   - **Full Connection String:**
     ```text
     postgresql://neondb_owner:npg_unl51hCzZjcB@ep-dawn-bread-b43uywng-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
     ```
   - **Purpose:** Used for all application API queries, job searches, user session persistence, application submission, and ERIS matching. Neon PgBouncer manages up to 10,000 pooled connections.

2. **Direct Connection (Mandatory for Migrations and DDL Schema Updates):**
   - **Endpoint:** `ep-dawn-bread-b43uywng.c-6.us-east-2.aws.neon.tech`
   - **Environment Variable:** `POSTGRES_URL_NON_POOLING`
   - **Full Connection String:**
     ```text
     postgresql://neondb_owner:npg_unl51hCzZjcB@ep-dawn-bread-b43uywng.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
     ```
   - **Purpose:** Used when executing schema migrations, transaction locks (`SKIP LOCKED`), and DDL commands.

---

## 3. Vercel Project Environment Variables Matrix

Configure these environment variables in your Vercel Dashboard under **Project Settings → Environment Variables**:

| Variable Name | Required | Target Environment | Production Example / Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | Production & Preview | Neon Pooled Connection String |
| `POSTGRES_URL` | **Yes** | Production & Preview | Neon Pooled Connection String (automatic in Vercel Neon integration) |
| `POSTGRES_URL_NON_POOLING` | Optional | Production | Neon Direct Unpooled Connection String |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Production | `https://avsar.aitathastu.com` |
| `AVSAR_APP_ORIGIN` | **Yes** | Production | `https://avsar.aitathastu.com` |
| `AVSAR_SESSION_SECRET` | **Yes** | Production | 32+ character random string (e.g. `openssl rand -base64 32`) |
| `AVSAR_ADMIN_SECRET` / `ADMIN_SECRET` | **Yes** | Production | Administrator password for `/admin` console |
| `ALLOW_DEMO_AUTH` | Recommended | Production & Preview | Set to `true` to enable instant one-click demo login for Rohan Sharma |
| `ALLOW_EPHEMERAL_LOCAL_STORAGE` | Optional | Preview | Set to `true` if S3 bucket is not configured for preview deployments |
| `STORAGE_PROVIDER` | Optional | Production | `s3` (or `local` if preview) |
| `STORAGE_BUCKET` | Optional | Production | AWS S3 or Cloudflare R2 bucket name for candidate resumes |
| `STORAGE_ACCESS_KEY_ID` | Optional | Production | S3 Access Key ID |
| `STORAGE_SECRET_ACCESS_KEY` | Optional | Production | S3 Secret Access Key |
| `STORAGE_REGION` | Optional | Production | `us-east-1` (or your cloud datacenter region) |

---

## 4. Database Schema Provisioning Status

The authoritative PostgreSQL DDL schema (`src/lib/db/schema.sql`) has been deployed to Neon:

- **Tables Created (11):**
  1. `candidates` (Candidate profiles, ERIS scores, preferences, skills, education)
  2. `jobs` (Normalized job postings, CTC claims, eligibility criteria)
  3. `applications` (Application submissions, answers, reference numbers)
  4. `resumes` (Resume metadata, storage keys, MIME types)
  5. `saved_jobs` (Candidate job bookmarks)
  6. `idempotency_keys` (RFC 7232 duplicate prevention)
  7. `durable_jobs` (Persistent background queue with `SKIP LOCKED`)
  8. `schema_migrations` (Version tracking audit ledger)
  9. `external_identities` (AI Tathastu SSO OAuth account linkages)
  10. `audit_events` (Security and administrative audit trail)
  11. `import_history` (Bulk job ingestion logs)

- **Indexes Created (23):**
  - Full-text search and category indexes on `jobs`
  - Unique composite constraints on `saved_jobs(candidate_id, job_id)` and `applications(job_id, candidate_id)`
  - Queue priority index on `durable_jobs(status, priority DESC, run_at ASC)`

- **Baseline Seed Dataset Provisioned:**
  - 131 Normalized Jobs across Frontend, Backend, Machine Learning, Data Analytics, and Product Design
  - 1 Verified Candidate Profile (`cand_rohan_sharma_001` - Rohan Sharma)
  - 39 Initial Applications and 2 Resumes

---

## 5. Health Probes & Operational Verification

Once deployed to Vercel, verify production readiness using the tri-level health probes:

```bash
# 1. Liveness Probe (Instant edge process check)
curl -i https://avsar.aitathastu.com/api/health/live

# 2. Readiness Probe (Verifies active Neon DB connection and pool availability)
curl -i https://avsar.aitathastu.com/api/health/ready

# 3. Comprehensive Diagnostics (Full infrastructure audit)
curl -i https://avsar.aitathastu.com/api/health/diagnostics
```

Expected HTTP status: `200 OK`.

---

## 6. Public User Journeys Verification Matrix

| Route | Journey | Expected Behavior |
| :--- | :--- | :--- |
| `/` | Landing / Welcome | Renders hero student visual, category pills, and "Get Started" CTA |
| `/auth` | Authentication | Google / Email OAuth and Instant Demo Access (Rohan Sharma) |
| `/home` | Candidate Dashboard | Shows personalized greeting, ERIS score, active filters, and job recommendations |
| `/explore` | Job Search & Filter | Full pagination, keyword search, remote/hybrid filters, instant match badges |
| `/jobs/[id]` | Job Detail | In-depth role breakdown, required skills, company info, and match rating |
| `/jobs/[id]/apply` | Multi-Step Application | 4-step wizard (Contact Info → Resume Selection → Questions → Review) |
| `/applications/success` | Submission Confirmation | Generates unique reference number (e.g. `AVS-2026-XXXX`) |
| `/applications` | Application Tracker | Tracks status ("Under Review", "Interview", "Shortlisted") |
| `/profile` | Profile & Resume Hub | Inline profile editor, skill tags, and resume document management |
| `/saved` | Bookmarks Hub | View and manage saved opportunities |
| `/admin` | Administration Console | Passkey-protected dashboard with metrics, charts, and bulk JSON job import |
| `/sitemap.xml` | SEO Indexation | Dynamically lists all static pages and top active job postings |
| `/robots.txt` | Crawler Directives | Allows discovery routes, disallows `/admin` and private APIs |

---

## 7. Zero-Downtime Release Protocol

1. Push all verified commits to branch `main`.
2. Vercel automatically detects the push and triggers production build with Turbopack.
3. Vercel runs Next.js serverless compilation, static page generation, and pre-renders static assets.
4. Edge routing switches to the new immutable deployment once healthy.
5. In the Vercel dashboard, verify that `https://avsar.aitathastu.com/` and `https://avsar-pahse-01.vercel.app/` display the green "Ready" status badge.
