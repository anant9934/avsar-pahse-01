# AVSAR OPERATIONAL RUNBOOK: ZERO-DOWNTIME SECRET ROTATION

**Scope:** Production Credential & Cryptographic Secret Lifecycle Management  
**Applicability:** Neon Serverless PostgreSQL, AI Tathastu OAuth, Session Encryption, Admin Passkeys  
**Governance:** AI Tathastu Engineering Operations (Phase 8)

---

## 1. SECRET INVENTORY & ROTATION FREQUENCY

| Secret Identifier | Target Service | Risk Profile | Rotation Cadence | Zero-Downtime Method |
|---|---|---|---|---|
| `DATABASE_URL` / `POSTGRES_READ_URL` | Neon Serverless PostgreSQL | High (DB access) | 90 days or on incident | Dual-role password rotation via Neon Console |
| `SESSION_SECRET` | Candidate session HMAC signature | High (Session forgery) | 180 days | Comma-separated dual-key grace window |
| `ADMIN_SECRET` | Recruiter & Admin API access | Critical (Admin privilege) | 90 days | Staged environment update with maintenance notice |
| `AI_TATHASTU_CLIENT_SECRET` | OAuth 2.0 PKCE Provider | High (SSO token exchange) | 180 days | Multi-secret provider support |
| `UPSTASH_REDIS_REST_TOKEN` | Distributed Cache & Rate Limiter | Medium (Cache access) | 180 days | Primary / Secondary dual tokens on Upstash |

---

## 2. STEP-BY-STEP ROTATION PROCEDURES

### 2.1 Neon PostgreSQL Credentials (`DATABASE_URL`)

Neon supports multiple database roles with distinct passwords.

1. **Create New Role or Secondary Password:**
   In Neon Console or via Neon CLI:
   ```bash
   neon roles create --name avsar_app_v2 --password <NEW_SECURE_PASSWORD>
   GRANT avsar_app TO avsar_app_v2;
   ```
2. **Update Staging / Preview Environment:**
   Update `DATABASE_URL` in Vercel project environment settings for Preview. Verify connections and migrations via `/api/health`.
3. **Deploy Production Environment Variable:**
   Update `DATABASE_URL` in Vercel Production Environment Variables.
4. **Trigger Zero-Downtime Redeployment:**
   Promote deployment. Next.js serverless functions immediately establish pools using the new credentials.
5. **Revoke Old Credentials:**
   After confirming zero active connections to old role for 1 hour:
   ```bash
   neon roles delete avsar_app_v1
   ```

---

### 2.2 Candidate Session Secret (`SESSION_SECRET`)

To prevent immediately logging out 8,000 active students during secret rotation:

1. **Generate Cryptographic Key:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. **Configure Dual Secret:**
   Set `SESSION_SECRET=<NEW_SECRET>,<OLD_SECRET>` in Vercel Environment Variables.
   - New sessions are signed with `<NEW_SECRET>`.
   - Existing active sessions signed with `<OLD_SECRET>` remain valid during verification.
3. **Retire Old Secret:**
   After 7 days (maximum session duration), remove `<OLD_SECRET>`, leaving only `<NEW_SECRET>`.

---

### 2.3 Upstash Redis Token (`UPSTASH_REDIS_REST_TOKEN`)

Upstash provides **Primary Token** and **Secondary Token** simultaneously.

1. In Upstash Console, note the Secondary Token.
2. If rotating Primary Token:
   - Update Vercel environment variable `UPSTASH_REDIS_REST_TOKEN` to the Secondary Token.
   - Redeploy and verify `/api/health/ready` reports Redis connected.
   - Reset the Primary Token in Upstash Console.
   - Update Vercel environment to the freshly generated Primary Token.

---

### 2.4 Administrative Passkey (`ADMIN_SECRET`)

1. Generate new 64-character high-entropy admin secret.
2. Notify authorized recruitment operators of scheduled credential change.
3. Update `ADMIN_SECRET` in Vercel environment settings.
4. Existing admin cookies are immediately invalidated upon login route verification using constant-time `safeCompare`.
5. Administrators authenticate using the new passkey.

---

## 3. INCIDENT ROTATION CHECKLIST

In the event of suspected credential compromise or leaked repository secret:
- [ ] 1. Identify compromised variable immediately from Git history or logs.
- [ ] 2. Issue emergency roll of the compromised provider token.
- [ ] 3. Update Vercel Environment Variables across Preview and Production.
- [ ] 4. Force immediate production redeploy with `vercel --prod`.
- [ ] 5. Purge application caches with `invalidateSearchCaches()`.
- [ ] 6. Inspect `audit_events` for unauthorized administrative access in the preceding 72 hours.
- [ ] 7. Document incident timeline and post-mortem in `docs/PRODUCTION_DEFECT_REGISTER.md`.
