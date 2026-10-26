import { createHmac, timingSafeEqual } from "node:crypto";
import { sanitizeReturnTo } from "./url-sanitizer.ts";

export { sanitizeReturnTo };

export interface RequestWithCookies {
  cookies: {
    get(name: string): { value?: string } | undefined;
    has?(name: string): boolean;
  };
  headers: {
    get(name: string): string | null;
  };
}

export interface SessionData {
  userId: string; // Internal candidate ID (e.g. cand_rohan_sharma_001)
  aiTathastuId?: string; // AI Tathastu stable user UUID
  name: string;
  email: string;
  avatar: string;
  role: "candidate" | "admin";
  provider: "ai_tathastu" | "demo_rohan" | "admin_key";
  createdAt: number;
  exp: number; // Unix timestamp in seconds
}

export const SESSION_COOKIE_NAME = "avsar_session";
export const OAUTH_STATE_COOKIE = "avsar_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "avsar_oauth_verifier";
export const OAUTH_RETURN_TO_COOKIE = "avsar_oauth_return_to";

// Default session lifetime: 7 days
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

// Secret used for HMAC-SHA256 session token signing
function getSessionSecret(): string {
  if (process.env.AVSAR_SESSION_SECRET) {
    return process.env.AVSAR_SESSION_SECRET;
  }
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CRITICAL: AVSAR_SESSION_SECRET or SESSION_SECRET environment variable must be set in production environments."
    );
  }
  return "avsar_dev_session_signing_secret_do_not_use_in_prod_32bytes";
}

/**
 * Cryptographically sign session payload using HMAC-SHA256
 */
export function signSessionPayload(payload: Omit<SessionData, "exp"> & { exp?: number }): string {
  const secret = getSessionSecret();
  const exp = payload.exp || Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const fullPayload: SessionData = { ...payload, exp };

  const serialized = JSON.stringify(fullPayload);
  const dataB64 = Buffer.from(serialized, "utf-8").toString("base64url");
  const signature = createHmac("sha256", secret).update(dataB64).digest("base64url");

  return `${dataB64}.${signature}`;
}

/**
 * Verify and parse HMAC-SHA256 signed session cookie value
 */
export function verifySessionToken(token: string | undefined | null): SessionData | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [dataB64, providedSig] = parts;
  if (!dataB64 || !providedSig) return null;

  try {
    const secret = getSessionSecret();
    const expectedSig = createHmac("sha256", secret).update(dataB64).digest("base64url");

    // Timing-safe signature comparison
    const sigBuf = Buffer.from(providedSig, "utf-8");
    const expBuf = Buffer.from(expectedSig, "utf-8");

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payloadJson = Buffer.from(dataB64, "base64url").toString("utf-8");
    const session = JSON.parse(payloadJson) as SessionData;

    // Check expiration
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (session.exp && session.exp < nowSeconds) {
      return null; // Expired
    }

    return session;
  } catch {
    return null;
  }
}

export interface CandidateAuthResult {
  candidateId: string;
  authenticated: boolean;
  user: SessionData | null;
  isDevFallback?: boolean;
}

/**
 * Resolve authenticated candidate from incoming Next.js request.
 * Enforces server-side authentication in production or when explicitly required.
 */
export function getAuthenticatedCandidate(
  request: RequestWithCookies,
  options: { requireAuth?: boolean } = {}
): CandidateAuthResult | null {
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isProduction = process.env.NODE_ENV === "production";
  const forceEnforce =
    options.requireAuth ||
    isProduction ||
    request.headers.get("x-enforce-auth") === "true";

  if (cookieValue) {
    const verified = verifySessionToken(cookieValue);
    if (verified && verified.userId) {
      return {
        candidateId: verified.userId,
        authenticated: true,
        user: verified,
      };
    }
    // If cookie was provided but invalid/tampered, treat as unauthenticated
    return null;
  }

  // If no cookie was provided
  if (forceEnforce) {
    return null; // Strict 401 required
  }

  // In local development / testing without strict flag, provide non-production fallback
  // with explicit `isDevFallback: true` flag
  return {
    candidateId: "cand_rohan_sharma_001",
    authenticated: false,
    user: null,
    isDevFallback: true,
  };
}
