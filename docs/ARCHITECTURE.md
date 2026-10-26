# Avsar Architecture Specification

## Overview

Avsar is a production-grade career platform engineered for Indian tech talent and students, featuring:
- AI Tathastu single sign-on (SSO) as an authoritative OAuth 2.0 / OIDC identity provider.
- Deterministic, reproducible candidate-job match scoring engine.
- Dual-mode data persistence: PostgreSQL 14+ for production high-concurrency deployments with automatic fallback to JSON file persistence for local development.
- Private durable object storage (AWS S3, Cloudflare R2, MinIO) with magic-bytes document verification for resume handling.

```
                           +----------------------------+
                           |       Client Browser       |
                           |  (Next.js Turbopack App)   |
                           +--------------+-------------+
                                          |
                                          | HTTPS / REST
                                          v
+-----------------------------------------------------------------------------------+
|                                Avsar Next.js Server                               |
|                                                                                   |
|  +--------------------+   +-----------------------+   +------------------------+  |
|  | Authentication     |   | Deterministic Matching|   | Dataset Normalization  |  |
|  | - RFC 7636 PKCE    |   | - 40% Skills Similarity|  | - LPA Range Extractor  |  |
|  | - HMAC-SHA256 Cook.|   | - 25% Experience Match|   | - Multi-Block Parser   |  |
|  | - ReturnTo Guard   |   | - 20% Education Match |   | - Deduplication Engine |  |
|  +---------+----------+   | - 15% Location Parity |   +-----------+------------+  |
|            |              +-----------+-----------+               |               |
|            v                          v                           v               |
|  +-----------------------------------------------------------------------------+  |
|  |                           Repository Layer                                  |  |
|  |  CandidateRepo | JobRepo | ApplicationRepo | SavedJobRepo | ResumeRepo     |  |
|  +------------------------------------+----------------------------------------+  |
+---------------------------------------|-------------------------------------------+
                                        |
                 +----------------------+----------------------+
                 |                                             |
                 v                                             v
  +------------------------------+             +-------------------------------+
  |    PostgreSQL Database       |             |  Private Durable S3 Storage   |
  |  - ACID Transactions         |             |  - Sandboxed Resumes          |
  |  - Connection Pooling        |             |  - Magic-Bytes Signature      |
  |  - Full Text & B-Tree Indexes|             |  - Presigned Download URLs    |
  +------------------------------+             +-------------------------------+
```

## Core Subsystems

### 1. Presentation Layer
- **Mobile-First Responsive Framework**: Custom `MobileShell` enforcing standard 390px/420px mobile viewport on desktop or fluid responsive expansion.
- **Visual Design Identity**: Warm ivory surfaces (`#F8F6F1`, `#EDEAE3`), forest green primary brand accent (`#285C45`), dark charcoal typography (`#242720`).
- **Accessibility**: Minimum 44px WCAG touch targets, focus-visible outlines, skip-to-content links, `prefers-reduced-motion` animations.

### 2. Matching Engine
The matching engine is deterministic and reproducible across arbitrary consecutive runs:
- **Skills Match (40%)**: Jaccard similarity across candidate skills and required job skills, plus bonus for optional skills.
- **Experience Match (25%)**: Ratio of total verified candidate experience against required job months.
- **Education Match (20%)**: Technical degree detection (B.Tech, B.E., BCA, MCA, Computer Science, IT).
- **Location Match (15%)**: 100% score for Remote work arrangements regardless of candidate city, 90% for matching city.

### 3. Authentication & Security
- **OAuth 2.0 PKCE**: RFC 7636 code verifier and S256 challenge generation.
- **Session Tokens**: Cryptographically signed HMAC-SHA256 tokens stored in HTTP-only, secure, `SameSite=Lax` cookies.
- **Open Redirect Guard**: Strict same-origin relative path validation rejecting external hosts, protocol-relative paths (`//`), backslashes (`\`), and CRLF injections.
- **Candidate Data Isolation**: Every candidate-owned entity (bookmarks, resumes, applications) is strictly verified against the authenticated user ID on the server.
