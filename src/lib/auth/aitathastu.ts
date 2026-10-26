import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface AIUserProfile {
  sub: string; // Stable AI Tathastu user UUID (primary external identity key)
  email?: string;
  name?: string;
  avatar?: string;
  scopes?: string[];
  skills?: string[];
  experience?: Array<{ company: string; role: string }>;
  education?: Array<{ institution: string; degree: string }>;
}

/**
 * Resolve the canonical deployment base URL based on environment configuration
 */
export function resolveDeploymentBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }
  if (process.env.AVSAR_APP_URL) {
    return process.env.AVSAR_APP_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * Resolve the OAuth callback redirect URI
 */
export function resolveRedirectUri(): string {
  if (process.env.AVSAR_AUTH_REDIRECT_URI) {
    return process.env.AVSAR_AUTH_REDIRECT_URI;
  }
  const baseUrl = resolveDeploymentBaseUrl();
  return `${baseUrl}/api/auth/aitathastu/callback`;
}

export const AUTH_CONFIG = {
  clientId: process.env.AI_TATHASTU_CLIENT_ID || "avsar",
  clientSecret: process.env.AI_TATHASTU_CLIENT_SECRET || "",
  issuer: (process.env.AI_TATHASTU_ISSUER_URL || "https://www.aitathastu.com").replace(/\/+$/, ""),
  get redirectUri(): string {
    return resolveRedirectUri();
  },
  cookieName: "avsar_session",
  stateCookieName: "avsar_oauth_state",
  verifierCookieName: "avsar_oauth_verifier",
  returnToCookieName: "avsar_oauth_return_to",
  onboardingUrl: "https://www.aitathastu.com/onboarding",
};

/**
 * Audit environment configuration at startup or runtime without leaking secrets.
 */
export function validateAuthConfig(): {
  isConfigured: boolean;
  isProductionReady: boolean;
  warnings: string[];
  configSummary: {
    issuer: string;
    clientId: string;
    redirectUri: string;
    hasClientSecret: boolean;
    hasSessionSecret: boolean;
  };
} {
  const warnings: string[] = [];
  const isProd = process.env.NODE_ENV === "production";

  if (!process.env.AI_TATHASTU_CLIENT_ID) {
    warnings.push("AI_TATHASTU_CLIENT_ID is not configured in environment.");
  }
  if (!process.env.AI_TATHASTU_CLIENT_SECRET) {
    warnings.push("AI_TATHASTU_CLIENT_SECRET is missing.");
  }
  if (!process.env.AVSAR_SESSION_SECRET && !process.env.SESSION_SECRET) {
    warnings.push("AVSAR_SESSION_SECRET or SESSION_SECRET is not configured (required for tamper-proof session cookies).");
  }
  if (!process.env.AVSAR_ADMIN_SECRET && isProd) {
    warnings.push("AVSAR_ADMIN_SECRET is not set in production. Administrative operations will be disabled.");
  }
  if (isProd && AUTH_CONFIG.redirectUri.includes("localhost")) {
    warnings.push("AVSAR_AUTH_REDIRECT_URI or NEXT_PUBLIC_APP_URL points to localhost in production.");
  }

  const isProductionReady =
    Boolean(process.env.AI_TATHASTU_CLIENT_ID) &&
    Boolean(process.env.AI_TATHASTU_CLIENT_SECRET) &&
    Boolean(process.env.AVSAR_SESSION_SECRET || process.env.SESSION_SECRET) &&
    Boolean(process.env.AVSAR_ADMIN_SECRET);

  return {
    isConfigured: Boolean(process.env.AI_TATHASTU_CLIENT_ID),
    isProductionReady,
    warnings,
    configSummary: {
      issuer: AUTH_CONFIG.issuer,
      clientId: AUTH_CONFIG.clientId,
      redirectUri: AUTH_CONFIG.redirectUri,
      hasClientSecret: Boolean(process.env.AI_TATHASTU_CLIENT_SECRET),
      hasSessionSecret: Boolean(process.env.AVSAR_SESSION_SECRET),
    },
  };
}

/**
 * Generate cryptographically secure PKCE code_verifier and S256 code_challenge according to RFC 7636.
 */
export function generatePKCE(): {
  verifier: string;
  challenge: string;
  state: string;
} {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
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
}): string {
  const url = new URL("/integrations/authorize", AUTH_CONFIG.issuer);
  url.searchParams.set("client_id", AUTH_CONFIG.clientId);
  url.searchParams.set("redirect_uri", AUTH_CONFIG.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");
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

export type TokenExchangeResult =
  | { ok: true; profile: AIUserProfile }
  | { ok: false; error: string; code?: string; isAccountDisabled?: boolean };

/**
 * Exchange authorization code for access/identity token and verify signature, issuer, audience, and expiration.
 */
export async function exchangeCodeForProfile(
  code: string,
  verifier: string,
  options?: {
    customFetch?: typeof fetch;
    jwksUri?: string;
  }
): Promise<TokenExchangeResult> {
  const fetchFn = options?.customFetch || fetch;

  try {
    const tokenUrl = new URL("/api/integrations/token", AUTH_CONFIG.issuer).toString();
    const resp = await fetchFn(tokenUrl, {
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
      let parsed: { error?: string; error_description?: string; message?: string } = {};
      try {
        parsed = JSON.parse(errBody);
      } catch {
        // text body
      }

      const errCode = parsed.error || "token_exchange_failed";
      const errDesc = parsed.error_description || parsed.message || errBody;

      const isAccountDisabled =
        errCode === "account_disabled" ||
        errCode === "account_deleted" ||
        /disabled|suspended|deleted/i.test(errDesc);

      return {
        ok: false,
        error: `Token exchange failed (${resp.status}): ${errDesc}`,
        code: errCode,
        isAccountDisabled,
      };
    }

    const json = (await resp.json()) as {
      access_token?: string;
      id_token?: string;
      token_type?: string;
      profile?: AIUserProfile;
    };

    const tokenToVerify = json.id_token || json.access_token;
    if (!tokenToVerify) {
      // In case provider returned direct profile payload in controlled mock
      if (json.profile && json.profile.sub) {
        return { ok: true, profile: json.profile };
      }
      return { ok: false, error: "Identity provider response missing access_token or id_token" };
    }

    // Verify token cryptographically
    const jwksUrl = options?.jwksUri
      ? new URL(options.jwksUri)
      : new URL("/api/integrations/jwks", AUTH_CONFIG.issuer);

    const JWKS = createRemoteJWKSet(jwksUrl);

    let payload: JWTPayload;
    try {
      const verified = await jwtVerify(tokenToVerify, JWKS, {
        issuer: AUTH_CONFIG.issuer,
        audience: AUTH_CONFIG.clientId,
        algorithms: ["ES256", "RS256"],
      });
      payload = verified.payload;
    } catch (jwtErr: unknown) {
      const msg = jwtErr instanceof Error ? jwtErr.message : String(jwtErr);
      return { ok: false, error: `JWT verification failed: ${msg}`, code: "invalid_jwt" };
    }

    if (!payload.sub || typeof payload.sub !== "string" || !payload.sub.trim()) {
      return {
        ok: false,
        error: "Verified token is missing mandatory stable subject identifier (sub).",
        code: "invalid_subject",
      };
    }

    return {
      ok: true,
      profile: {
        sub: String(payload.sub),
        email: typeof payload.email === "string" ? payload.email : undefined,
        name: typeof payload.name === "string" ? payload.name : undefined,
        avatar: typeof payload.picture === "string" ? payload.picture : undefined,
        scopes: Array.isArray(payload.scopes)
          ? (payload.scopes as string[])
          : typeof payload.scope === "string"
          ? (payload.scope as string).split(" ")
          : undefined,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Authentication verification error: ${message}`, code: "internal_error" };
  }
}
