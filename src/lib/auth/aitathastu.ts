import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AIUserProfile {
  sub: string; // Tathastu user UUID
  email?: string;
  name?: string;
  avatar?: string;
  scopes?: string[];
  skills?: string[];
  experience?: Array<{ company: string; role: string }>;
  education?: Array<{ institution: string; degree: string }>;
}

export interface SessionData {
  userId: string;
  name: string;
  email: string;
  avatar: string;
  provider: "ai_tathastu" | "demo_rohan";
  createdAt: number;
}

// Configuration from environment with robust fallbacks
export const AUTH_CONFIG = {
  clientId: process.env.AI_TATHASTU_CLIENT_ID || "avsar",
  clientSecret: process.env.AI_TATHASTU_CLIENT_SECRET || "avsar_dev_secret_key",
  issuer: process.env.AI_TATHASTU_ISSUER_URL || "https://www.aitathastu.com",
  redirectUri:
    process.env.AVSAR_AUTH_REDIRECT_URI || "http://localhost:3000/api/auth/aitathastu/callback",
  cookieName: "avsar_session",
  stateCookieName: "avsar_oauth_state",
  verifierCookieName: "avsar_oauth_verifier",
};

/**
 * Generate PKCE code_verifier and code_challenge (S256) according to RFC 7636
 */
export function generatePKCE() {
  const verifier = randomBytes(32)
    .toString("base64url")
    .replace(/[^A-Za-z0-9_-]/g, "");

  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");

  const state = randomBytes(24).toString("base64url");

  return {
    verifier,
    challenge,
    state,
  };
}

/**
 * Build the AI Tathastu OAuth 2.0 authorization URL
 */
export function buildAuthorizeUrl(options: {
  challenge: string;
  state: string;
  prompt?: "consent" | "login";
  providerHint?: "google" | "email";
  returnTo?: string;
}) {
  const url = new URL("/integrations/authorize", AUTH_CONFIG.issuer);
  url.searchParams.set("client_id", AUTH_CONFIG.clientId);
  url.searchParams.set("redirect_uri", AUTH_CONFIG.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", options.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", options.state);

  if (options.prompt) {
    url.searchParams.set("prompt", options.prompt);
  }
  if (options.providerHint) {
    url.searchParams.set("provider", options.providerHint);
  }
  if (options.returnTo) {
    url.searchParams.set("return_to", options.returnTo);
  }

  return url.toString();
}

/**
 * Exchange authorization code for ES256 JWT access token and verify against JWKS
 */
export async function exchangeCodeForProfile(
  code: string,
  verifier: string
): Promise<{ ok: true; profile: AIUserProfile } | { ok: false; error: string }> {
  try {
    const tokenUrl = new URL("/api/integrations/token", AUTH_CONFIG.issuer).toString();
    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: AUTH_CONFIG.clientId,
        client_secret: AUTH_CONFIG.clientSecret,
        code,
        code_verifier: verifier,
        redirect_uri: AUTH_CONFIG.redirectUri,
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      return { ok: false, error: `Token exchange failed (${resp.status}): ${errBody}` };
    }

    const json = (await resp.json()) as { access_token: string; token_type: string };
    const accessToken = json.access_token;

    // Verify token using Tathastu's public JWKS endpoint
    const jwksUrl = new URL("/api/integrations/jwks", AUTH_CONFIG.issuer);
    const JWKS = createRemoteJWKSet(jwksUrl);

    const { payload } = await jwtVerify(accessToken, JWKS, {
      issuer: AUTH_CONFIG.issuer,
      audience: AUTH_CONFIG.clientId,
      algorithms: ["ES256"],
    });

    return {
      ok: true,
      profile: {
        sub: String(payload.sub),
        email: payload.email as string | undefined,
        name: payload.name as string | undefined,
        avatar: payload.picture as string | undefined,
        scopes: payload.scopes as string[] | undefined,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Authentication verification error: ${message}` };
  }
}
