import type { NextRequest } from "next/server";

// Standard IPv4 and IPv6 validation patterns
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$|^::1$|^::$|^(?:[a-fA-F0-9]{1,4}:)*::(?:[a-fA-F0-9]{1,4}:)*[a-fA-F0-9]{1,4}$/;

/**
 * Validates whether a candidate string is a well-formed IPv4 or IPv6 address.
 */
export function isValidIp(ip: string): boolean {
  const trimmed = ip.trim();
  return IPV4_REGEX.test(trimmed) || IPV6_REGEX.test(trimmed);
}

/**
 * Extracts and sanitizes the true client IP from an incoming HTTP request.
 * Prioritizes platform-authenticated edge headers (Vercel, Cloudflare) that
 * cannot be spoofed by HTTP clients, followed by defensive X-Forwarded-For parsing.
 */
export function resolveClientIp(request: Request | NextRequest | { headers: Headers }): string {
  const headers = request.headers;

  // 1. Edge-authenticated platform headers (tamper-proof on Vercel & Cloudflare)
  const xVercelForwardedFor = headers.get("x-vercel-forwarded-for");
  if (xVercelForwardedFor) {
    const candidate = xVercelForwardedFor.split(",")[0].trim();
    if (isValidIp(candidate)) return candidate;
  }

  const xRealIp = headers.get("x-real-ip");
  if (xRealIp) {
    const candidate = xRealIp.trim();
    if (isValidIp(candidate)) return candidate;
  }

  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    const candidate = cfConnectingIp.trim();
    if (isValidIp(candidate)) return candidate;
  }

  // 2. Standard X-Forwarded-For header
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    // If multiple IPs are chained (client, proxy1, proxy2), inspect elements
    const ips = xForwardedFor.split(",").map((s) => s.trim());
    for (const ip of ips) {
      if (isValidIp(ip)) {
        return ip;
      }
    }
  }

  // 3. Fallback for local testing or unroutable synthetic requests
  return "127.0.0.1";
}
