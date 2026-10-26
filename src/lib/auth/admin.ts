import { SESSION_COOKIE_NAME, verifySessionToken, type RequestWithCookies } from "./session.ts";
import { safeCompare } from "./timing-safe.ts";
import { checkAdminRateLimit, resetAdminRateLimits } from "./rate-limiter.ts";
import {
  logAdminAction,
  getAdminAuditLogs,
  clearAdminAuditLogs,
  type AdminAuditEntry,
} from "./audit-logger.ts";

export {
  safeCompare,
  checkAdminRateLimit,
  resetAdminRateLimits,
  logAdminAction,
  getAdminAuditLogs,
  clearAdminAuditLogs,
};
export type { AdminAuditEntry };

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
