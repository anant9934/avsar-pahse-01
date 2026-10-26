# Neon Serverless PostgreSQL Setup & Operational Runbook

> **Platform:** Avsar by AI Tathastu  
> **Repository:** [https://github.com/anant9934/avsar-pahse-01.git](https://github.com/anant9934/avsar-pahse-01.git)  
> **Production Database Provider:** Neon Serverless PostgreSQL  
> **Console URL:** [https://console.neon.tech/](https://console.neon.tech/)  
> **Documentation:** [https://neon.tech/docs](https://neon.tech/docs)  

---

## 1. Overview & Architecture

Avsar utilizes **Neon Serverless PostgreSQL** as its primary relational persistence layer for production deployments. Neon delivers serverless scalability, instant database branching, automatic compute auto-scaling, and built-in connection pooling via PgBouncer.

### Connection Architecture
- **Next.js Serverless & Multi-Instance:** Always connect via Neon's **Pooled Endpoint** (`-pooler.[region].aws.neon.tech`) to prevent database connection starvation during high-concurrency bursts.
- **Migration & Admin Tasks:** DDL migration scripts and large schema changes can safely execute against either the pooled or direct endpoint.
- **Security & TLS:** Neon enforces mandatory TLS encryption (`sslmode=require`) across all connection modes.

---

## 2. Step-by-Step Neon Project Provisioning

Follow these steps in the Neon Web Console to configure the database:

### Step 2.1: Create a Neon Project
1. Log in to [https://console.neon.tech/](https://console.neon.tech/).
2. Click **New Project**.
3. Configure project details:
   - **Project Name:** `avsar-production`
   - **Postgres Version:** `16` (or `15`+)
   - **Region:** Select the region closest to your compute hosts (e.g., `AWS US East (Ohio) us-east-2` or `AWS Asia Pacific (Singapore) ap-southeast-1`).
4. Click **Create Project**.

### Step 2.2: Identify Credentials and Endpoints
Once the project is initialized, Neon presents your connection credentials on the **Dashboard**:
- **Host:** e.g., `ep-cool-mountain-123456.us-east-2.aws.neon.tech`
- **Database:** `neondb` (or custom `avsar`)
- **Username:** e.g., `avsar_owner`
- **Password:** Provided in the console modal (save securely in a password manager).

### Step 2.3: Obtain the Pooled Connection String
1. On the Neon Dashboard, locate the **Connection Details** card.
2. Toggle the **Connection Pooling** switch to **ON**.
3. Notice that the hostname changes to include `-pooler`:
   ```text
   ep-cool-mountain-123456-pooler.us-east-2.aws.neon.tech
   ```
4. Copy the complete connection string:
   ```text
   postgresql://avsar_owner:PASSWORD@ep-cool-mountain-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

---

## 3. Environment Configuration

### Local Testing Configuration (`.env.local`)
To test against Neon in development:
```env
# In .env.local (do NOT commit to git)
DATABASE_URL=postgresql://avsar_owner:YOUR_ACTUAL_NEON_PASSWORD@ep-cool-mountain-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=5000
```

### Production Hosting Configuration (Vercel / AWS / Cloud Run)
Configure environment variables in your deployment platform's secret settings:
- `DATABASE_URL`: The Neon pooled connection string.
- `NODE_ENV`: `production`
- `AVSAR_SESSION_SECRET`: 32+ character high-entropy key (`openssl rand -base64 32`)
- `AI_TATHASTU_CLIENT_ID`: IdP Client ID
- `AI_TATHASTU_CLIENT_SECRET`: IdP Client Secret
- `STORAGE_PROVIDER`: `s3`
- `STORAGE_BUCKET`: Private resume S3 bucket name

> [!IMPORTANT]
> In production (`NODE_ENV=production`), Avsar strictly enforces `DATABASE_URL`. If `DATABASE_URL` is omitted, the application refuses to start with ephemeral storage and returns HTTP 503 on health checks.

---

## 4. Running Database Migrations

Avsar includes an idempotent, transactional migration script located at [`scripts/migrate-to-postgres.mjs`](file:///Users/quantum/Desktop/avsar/scripts/migrate-to-postgres.mjs).

### Step 4.1: Dry-Run Validation
Before modifying the live database, run a dry-run to validate schema files, source records, and mapping tables:
```bash
node scripts/migrate-to-postgres.mjs --dry-run
```

### Step 4.2: Execute Live Migration to Neon
Provide the Neon connection string and execute the migration:
```bash
DATABASE_URL="postgresql://avsar_owner:PASSWORD@ep-cool-mountain-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require" \
node scripts/migrate-to-postgres.mjs
```

The migration runner will:
1. Create a timestamped local backup of source JSON data.
2. Connect securely using TLS encryption.
3. Apply relational DDL tables and indexes from [`src/lib/db/schema.sql`](file:///Users/quantum/Desktop/avsar/src/lib/db/schema.sql).
4. Idempotently upsert candidates, external identities, jobs, resumes, applications, and bookmarks.
5. Reconcile record counts and display a summary report.

---

## 5. Verification & Health Monitoring

### Verification via Health Endpoint
After deployment, verify database readiness by querying `/api/health`:
```bash
curl -i https://avsar.yourdomain.com/api/health
```

Expected JSON response:
```json
{
  "status": "ok",
  "environment": "production",
  "uptimeSeconds": 142,
  "services": {
    "database": {
      "status": "healthy",
      "type": "neon",
      "isPooled": true,
      "latencyMs": 18
    },
    "storage": {
      "provider": "s3",
      "status": "healthy"
    },
    "auth": {
      "isConfigured": true,
      "isProductionReady": true
    }
  }
}
```

### SQL Verification in Neon Console SQL Editor
Open the **SQL Editor** tab in the Neon Console and execute:
```sql
-- 1. Verify table counts
SELECT 'candidates' AS tbl, count(*) FROM candidates
UNION ALL
SELECT 'jobs', count(*) FROM jobs
UNION ALL
SELECT 'resumes', count(*) FROM resumes
UNION ALL
SELECT 'applications', count(*) FROM applications
UNION ALL
SELECT 'saved_jobs', count(*) FROM saved_jobs;

-- 2. Check indexes
SELECT tablename, indexname FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

---

## 6. Disaster Recovery & Branching

Neon provides **instant zero-copy database branching**, enabling safe testing, preview environments, and instant recovery:

### Creating an Isolated Staging Branch
1. In the Neon Console, click **Branches** -> **New Branch**.
2. Name the branch `staging` or `migration-test`.
3. Select parent branch: `main`.
4. Run your migration tests against this branch connection string without affecting production data.

### Rollback Strategy
If a schema deployment needs recovery:
1. Automatic backups of pre-migration JSON states are preserved in `data/db.json.migration-backup-*.json`.
2. In the Neon Console, use **Time Travel / Point-in-Time Restore** to restore the branch to the exact timestamp prior to migration.
