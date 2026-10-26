# avsar-pahse-01

# Avsar — Opportunity Discovery & Intelligent Career Matching Platform

> **Engineered by AI Tathastu**  
> **Lead Engineer & Author:** Anant Kumar ([@anant9934](https://github.com/anant9934))  
> **Repository:** [https://github.com/anant9934/avsar-pahse-01.git](https://github.com/anant9934/avsar-pahse-01.git)

---

## 🌟 Executive Overview

**Avsar** (अवसर — *Opportunity*) is a career exploration, deterministic job matching, and application tracking platform engineered specifically for early-career software engineers and university graduates. 

Avsar bridges the gap between aspiring technologists and top-tier engineering organizations through a mathematical, multi-dimensional matching engine that evaluates candidate skills, experience levels, location compatibility, and graduation year eligibility without hallucination or opaque scoring.

---

## 🏛️ Key System Highlights

- **🎯 Deterministic Matching Engine**: 100-point transparent score computed across 4 dimensions:
  - **Skills Overlap (50 pts)**: Weighted Jaccard & substring similarity over required vs. candidate skills.
  - **Experience Alignment (20 pts)**: Mathematical proximity to job minimum and maximum experience brackets.
  - **Location Compatibility (15 pts)**: Full credit for Remote/Anywhere, high affinity for city matches.
  - **Batch & Education (15 pts)**: Strict graduation year eligibility constraints with human-readable explanations.
- **💼 Verified Dataset Ingestion**: Ingests, normalizes, deduplicates, and validates **54 verified software jobs** from the real `jobs.json` dataset, preserving source IDs, batch restrictions, and external application URLs.
- **🔐 AI Tathastu Single Sign-On (SSO)**:
  - RFC 7636 OAuth 2.0 with PKCE (Proof Key for Code Exchange).
  - Timing-safe HMAC-SHA256 session signature verification.
  - Role-based access control (`candidate` and `admin`).
- **💾 Dual-Persistence Architecture**:
  - **Production**: PostgreSQL with connection pooling (`pg.Pool`), normalized relational schema, and ACID transactions.
  - **Local / Edge**: High-performance JSON-backed file repository (`data/db.json`) for seamless zero-dependency local development.
- **🛡️ Enterprise Security & Hardening**:
  - **Magic Bytes Validation**: Verifies binary headers (`%PDF`, `PK\x03\x04`) on all resume uploads.
  - **BOLA / IDOR Prevention**: Strict candidate identity checks on resume and application endpoints.
  - **SSRF & Open Redirect Shield**: Whitelisted URI destinations and loopback/private subnet blocking.
  - **Rate Limiting & Masked Audit Logs**: In-memory token bucket rate limiting and privacy-preserving audit logs.
- **📱 Premium Mobile-First Design System**:
  - Warm ivory surfaces (`#FAF8F5`), forest green primary accents (`#1B4332`), and warm cream cards.
  - WCAG 2.1 AA compliant typography, 44px minimum touch targets, and accessible ARIA attributes.

---

## 📂 Architecture & Directory Map

```text
avsar/
├── data/
│   ├── db.json                     # Persistent JSON repository (54 verified jobs, candidate state)
│   └── resumes/                    # Private local resume vault (gitignored)
├── docs/                           # Comprehensive Engineering Documentation
│   ├── ARCHITECTURE.md             # Subsystem design & architecture diagrams
│   ├── DESIGN_SYSTEM.md           # Tokens, typography scales, & WCAG specifications
│   ├── MATCHING_ALGORITHM.md      # Deterministic formulas, weights, & eligibility rules
│   ├── AI_TATHASTU_SSO.md          # OAuth 2.0 PKCE, session security, & claim verification
│   ├── DATABASE_MIGRATION.md      # PostgreSQL schema, connection pooling, & migration CLI
│   └── SECURITY_AUDIT.md          # OWASP Top 10 mitigations & audit logging
├── scripts/
│   └── migrate-to-postgres.mjs    # Idempotent database migration script
├── src/
│   ├── app/                        # Next.js 16 App Router pages & API handlers
│   │   ├── (candidate routes)      # explore, jobs/[slug], apply, profile, applications, saved
│   │   ├── admin/                  # Administrative metrics & job management portal
│   │   └── api/                    # RESTful endpoints for auth, jobs, resumes, applications
│   ├── components/                 # Reusable UI components (JobCard, MobileShell, BottomNav, etc.)
│   ├── lib/
│   │   ├── auth/                   # PKCE, timing-safe equality, rate limiting, audit logger
│   │   ├── db/                     # PostgreSQL pool, schema.sql, and JSON file DB adapter
│   │   ├── jobs/                   # Job normalization, deduplication, and ingestion pipeline
│   │   ├── matching/               # Deterministic scoring sub-engines (skills, exp, loc, batch)
│   │   ├── repository/             # Dual repository pattern implementation (Postgres & File)
│   │   └── storage/                # Magic bytes validator and multi-provider resume storage
│   └── types/                      # Strictly typed domain models (Job, Candidate, Application, etc.)
└── test/                           # Automated Test Suite (66/66 passing)
    ├── *.test.mjs                  # Integration test suites for critical candidate journeys
    └── unit/*.test.mjs             # Unit test suites for matching, storage, and security
```

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- **Node.js**: v18.18.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL** *(optional for local dev, mandatory for production)*

### 2. Installation
```bash
git clone https://github.com/anant9934/avsar-pahse-01.git
cd avsar-pahse-01
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Configure your environment variables as needed:
```ini
NODE_ENV=development
PORT=3000
SESSION_SECRET=avsar_development_session_secret_key_minimum_32_characters_long_12345
AI_TATHASTU_CLIENT_ID=avsar-dev-client
AI_TATHASTU_CLIENT_SECRET=avsar-dev-secret
AI_TATHASTU_ISSUER_URL=https://auth.aitathastu.org
# DATABASE_URL=postgres://user:password@localhost:5432/avsar
```

### 4. Running the Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) to access Avsar.

---

## 🧪 Testing & Quality Assurance

Avsar maintains a comprehensive test suite covering unit calculations, security boundaries, and full end-to-end user journeys:

```bash
# Run all 66 automated test suites
npm test

# Run code style and ESLint verification
npm run lint

# Run TypeScript type-checking
npx tsc --noEmit

# Compile production build
npm run build
```

### Test Coverage Highlights
- ✅ **Integration Journeys**: Authentication, job discovery, private resume upload, application submission, duplicate prevention, and admin metrics.
- ✅ **Deterministic Matching**: Exact skill overlap scoring, graduation year eligibility gating, and experience bracket evaluation.
- ✅ **Security Mitigations**: Magic bytes file upload validation, BOLA prevention, timing attack resistance, and rate limiting.
- ✅ **Health & Readiness**: Synthetic diagnostics probe (`/api/health`) verifying database connectivity, storage mode, and SSO readiness.

---

## 🗄️ Database Migration (PostgreSQL)

To migrate from the local file repository to a production PostgreSQL database:

```bash
# Run dry-run validation (checks schema, parses data/db.json, verifies constraints)
node scripts/migrate-to-postgres.mjs --dry-run

# Execute live migration with active database
DATABASE_URL="postgres://user:password@localhost:5432/avsar" node scripts/migrate-to-postgres.mjs
```

---

## 📄 License & Attribution

Designed and engineered for **AI Tathastu**.  
Authored by **Anant Kumar** ([@anant9934](https://github.com/anant9934)).  
All rights reserved.
