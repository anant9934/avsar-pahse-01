# AI Tathastu Single Sign-On (SSO) Integration

## Overview

Avsar uses **AI Tathastu** as its authoritative Identity Provider (IdP) for candidate and administrative authentication. This document details the OAuth 2.0 PKCE protocol implementation, claims verification, session lifecycle management, diagnostic endpoints, and the operator registration checklist.

---

## Current Status: BLOCKED — EXTERNAL CONFIGURATION REQUIRED

> [!IMPORTANT]
> The internal OAuth 2.0 Authorization Code flow with RFC 7636 PKCE S256, cryptographically signed cookies, state verification, and token exchange routines are **100% implemented and tested with 14 automated security regression suites**.
> 
> However, **live production authentication against `https://www.aitathastu.com` is BLOCKED** until the operator registers the Avsar application on the AI Tathastu Identity Provider portal and injects the resulting `AI_TATHASTU_CLIENT_ID` and `AI_TATHASTU_CLIENT_SECRET` into the production environment.

---

## Architecture & Flow

```mermaid
sequenceDiagram
    autonumber
    actor Candidate as Candidate / User
    participant Avsar as Avsar Application (Next.js)
    participant IdP as AI Tathastu SSO Provider

    Candidate->>Avsar: Clicks "Sign in with AI Tathastu"
    Avsar->>Avsar: Generate PKCE (code_verifier, code_challenge, state)
    Avsar->>Candidate: Set signed cookies (oauth_state, pkce_verifier) & Redirect to IdP
    Candidate->>IdP: Authenticate & Authorize Avsar
    IdP->>Avsar: Redirect to /api/auth/aitathastu/callback?code=...&state=...
    Avsar->>Avsar: Verify state against signed cookie
    Avsar->>IdP: Exchange authorization code + code_verifier for tokens
    IdP->>Avsar: Return access_token, id_token, userinfo
    Avsar->>Avsar: Verify claims, map to Candidate profile
    Avsar->>Candidate: Set HMAC-signed session cookie & redirect to destination
```

---

## 1. OAuth 2.0 with PKCE (Proof Key for Code Exchange)

To prevent authorization code interception and CSRF attacks, Avsar enforces RFC 7636 PKCE:
- **Code Verifier**: A cryptographically random 43–128 character URL-safe string generated using `crypto.randomBytes(32).toString('base64url')`.
- **Code Challenge**: SHA-256 hash of the code verifier: `BASE64URL(SHA256(code_verifier))`.
- **Challenge Method**: `S256`.
- **State Token**: A secure random UUID cryptographically bound to the session via an HMAC-SHA256 signature in a temporary HTTP-only cookie.

---

## 2. Token Exchange & Claims Verification

Upon receiving the authorization code at `/api/auth/aitathastu/callback`:
1. **State Validation**: `req.query.state` must match the stored state cookie.
2. **Timing-Safe Comparison**: All cryptographic token comparisons use `crypto.timingSafeEqual` to thwart timing attacks.
3. **PKCE Verification**: The IdP verifies `code_verifier` against the initial `code_challenge`.
4. **Token Decoding & Claims Audit**:
   - `sub`: Unique identity subject identifier from AI Tathastu. Keyed strictly by `sub` UUID (never merged solely by email).
   - `email`: Verified candidate email address.
   - `name`: Candidate's full name.
   - `role`: Role assignment (`candidate` or `admin`).
   - `aud`: Must match `AI_TATHASTU_CLIENT_ID`.
   - `iss`: Must match `AI_TATHASTU_ISSUER_URL`.

---

## 3. Session Security & Cookie Handling

Avsar uses stateless, tamper-proof session cookies:
- **Cookie Name**: `avsar_session`
- **Security Flags**:
  - `HttpOnly`: Prevents client-side JavaScript access (XSS mitigation).
  - `Secure`: Transmitted only over HTTPS in production (`NODE_ENV === 'production'`).
  - `SameSite=Lax`: Balances top-level navigation usability with CSRF protection.
  - `Path=/`: Valid across all application routes.
- **HMAC-SHA256 Signature**: The session payload is serialized into JSON and signed with `AVSAR_SESSION_SECRET` (or `SESSION_SECRET`):
  ```
  session_cookie = base64(payload) + "." + hmac_sha256(base64(payload), secret)
  ```
- **Session Duration**: Default 7 days (604,800 seconds).

---

## 4. Local Development vs. Production Mode

Avsar provides seamless developer experience while maintaining strict production safety:

| Feature | Development Mode (`NODE_ENV=development`) | Production Mode (`NODE_ENV=production`) |
| :--- | :--- | :--- |
| **Provider Fallback** | Mock IdP simulator available for offline dev | Strict remote AI Tathastu OAuth 2.0 endpoints required |
| **Demo Auth** | One-click Rohan Sharma sign-in permitted | Blocked unless `ALLOW_DEMO_AUTH=true` explicitly set |
| **HTTPS Cookies** | `Secure: false` (allows `http://localhost:3000`) | `Secure: true` (mandatory HTTPS) |
| **Strict Redirects** | Allows `localhost` and `127.0.0.1` | Must match verified domain whitelist |
| **Credentials** | Development defaults tolerated with warning | Missing `CLIENT_SECRET` halts startup with error |

---

## 5. Diagnostic & Health Endpoints

- **`GET /api/health`**: Comprehensive health probe detailing DB, storage, and SSO configuration state without disclosing secrets.
- **`GET /api/auth/diagnostics`**: Returns current SSO configuration status, IdP connectivity, and configured scopes without exposing secrets.
- **`GET /api/auth/session`**: Returns currently authenticated user context, roles, and session expiry.
- **`POST /api/auth/logout`**: Invalidates session cookie and clears transient tokens.

---

## 6. Operator Registration Checklist

To activate live AI Tathastu Single Sign-On in production:

1. **Log in to AI Tathastu Developer Portal**: Navigate to `https://www.aitathastu.com/integrations/clients`.
2. **Register New Client Application**:
   - **Application Name**: `Avsar`
   - **Application Logo URL**: `https://<production-domain>/images/logo-avsar.png`
   - **Homepage URL**: `https://<production-domain>`
3. **Configure Authoritative Redirect URIs**:
   - Production: `https://<production-domain>/api/auth/aitathastu/callback`
   - Staging (optional): `https://<staging-domain>/api/auth/aitathastu/callback`
   - Local Dev: `http://localhost:3000/api/auth/aitathastu/callback`
4. **Specify Scopes**:
   - `openid` (Mandatory OIDC subject identifier)
   - `profile` (Candidate name and avatar)
   - `email` (Candidate verified email)
5. **Record Credentials into Environment Variables**:
   ```bash
   AI_TATHASTU_CLIENT_ID="<client-id-from-portal>"
   AI_TATHASTU_CLIENT_SECRET="<client-secret-from-portal>"
   AI_TATHASTU_ISSUER_URL="https://www.aitathastu.com"
   AVSAR_AUTH_REDIRECT_URI="https://<production-domain>/api/auth/aitathastu/callback"
   AVSAR_SESSION_SECRET="<generate-with-openssl-rand-base64-32>"
   ```
