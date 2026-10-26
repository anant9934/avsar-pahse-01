<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AVSAR BY AI TATHASTU — PERSISTENT ENGINEERING GOVERNANCE PROTOCOL

## 1. Commit Policy & Author Identity
- **Required Author:** `Anant Kumar <anant9934@users.noreply.github.com>`.
- **Strict One-File, One-Change, One-Commit Protocol:** Every independently meaningful change to an individual file receives its own commit.
- **Exceptions:** Tightly coupled multi-file changes are permitted only when separation would break compilation or runtime integrity.
- **No Artificial Commits:** Formatting-only, whitespace-only, duplicate, or trivial constant splitting commits are strictly forbidden.

## 2. Evidence-Based Verification Standard
- Never assume previous agent reports are ground truth. Inspect working tree, Git logs, and actual application behavior.
- Every claim of functionality, latency, or concurrency must be supported by reproducible commands (`npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, benchmarks).
- Never report simulated or in-process benchmarks as live multi-server production results.

## 3. Security & Data Protection Rules
- Never expose API keys, database passwords, OAuth secrets, session tokens, or private resume data in code, logs, tests, or documentation.
- Authenticate and authorize every endpoint at the data boundary; never trust client-supplied candidate IDs or roles alone.
- Enforce private access to candidate resumes via short-lived signed URLs.
- Prevent timing attacks using constant-time comparison for all security-sensitive tokens.

## 4. Distributed Systems & Database Correctness
- Concurrency-safe application submissions must be enforced at the database schema level (unique constraints and atomic transactions), never by UI button states alone.
- Non-authoritative process-local memory caches or queues must be clearly documented; durable delivery requires transactional outbox or persistent queuing.
- All database mutations must target the authoritative primary; read replicas must preserve read-after-write consistency.

