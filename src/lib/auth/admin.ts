import { timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE_NAME, verifySessionToken, type RequestWithCookies } from "./session.ts";

export const ADMIN_COOKIE_NAME = "avsar_admin_session";
export const ADMIN_KEY_HEADER = "x-admin-key";

/**
 * Resolve effective administrative secret.
 * In production environments, AVSAR_ADMIN_SECRET is strictly required.
 * If unset in production, admin operations are disabled fail-safe.
 */
export function getAdminSecret(): string | null {
  if (process.env.AVSAR_ADMIN_SECRET) {
    return process.env.AVSAR_ADMIN_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    // In production, no static fallback is permitted
    return null;
  }
  // Local development / testing default
  return "avsar_admin_secret_2025";
}

export interface AdminAuditEntry {
  timestamp: string;
  action: string;
  ip?: string;
  success: boolean;
  details?: string;
}

// In-memory audit log for sensitive administrative operations
const auditLogs: AdminAuditEntry[] = [];

export function logAdminAction(entry: Omit<AdminAuditEntry, "timestamp">) {
  auditLogs.unshift({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  if (auditLogs.length > 500) {
    auditLogs.pop();
  }
}

export function getAdminAuditLogs(): AdminAuditEntry[] {
  return [...auditLogs];
}

// In-memory rate limiting for admin login attempts
interface RateLimitTracker {
  attempts: number;
  firstAttemptAt: number;
}
const loginAttempts = new Map<string, RateLimitTracker>();

export function checkAdminRateLimit(ipOrKey: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxAttempts = 10;

  const tracker = loginAttempts.get(ipOrKey);
  if (!tracker) {
    loginAttempts.set(ipOrKey, { attempts: 1, firstAttemptAt: now });
    return { allowed: true };
  }

  if (now - tracker.firstAttemptAt > windowMs) {
    // Reset window
    loginAttempts.set(ipOrKey, { attempts: 1, firstAttemptAt: now });
    return { allowed: true };
  }

  tracker.attempts += 1;
  if (tracker.attempts > maxAttempts) {
    const retryAfter = Math.ceil((tracker.firstAttemptAt + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfter) };
  }

  return { allowed: true };
}

/**
 * Timing-safe string comparison
 */
function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf-8");
    const bufB = Buffer.from(b, "utf-8");
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Server-enforced administrator authorization check.
 */
export function checkAdminAuth(request: RequestWithCookies): { authorized: boolean; reason?: string } {
  const secret = getAdminSecret();

  // If in production and secret is not configured, deny all admin access
  if (!secret) {
    return {
      authorized: false,
      reason: "Forbidden: Admin access is disabled because AVSAR_ADMIN_SECRET is not configured in production.",
    };
  }

  // 1. Direct header verification (API automation / scripts / test suites)
  const headerKey = request.headers.get(ADMIN_KEY_HEADER);
  if (headerKey && safeCompare(headerKey, secret)) {
    return { authorized: true };
  }

  // 2. Dedicated admin session cookie (must be cryptographically verified)
  const adminCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (adminCookie) {
    const verifiedAdminSession = verifySessionToken(adminCookie);
    if (verifiedAdminSession && verifiedAdminSession.role === "admin") {
      return { authorized: true };
    }
  }

  // 3. Main session cookie with verified admin role
  const userCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (userCookie) {
    const verifiedUserSession = verifySessionToken(userCookie);
    if (verifiedUserSession && verifiedUserSession.role === "admin") {
      return { authorized: true };
    }
  }

  return { authorized: false, reason: "Unauthorized: Administrator authorization required." };
}
