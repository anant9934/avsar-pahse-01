import { isValidIp } from "./ip-resolver.ts";

/**
 * Trusted proxy CIDR blocks and IP evaluation for defensive rate-limiting.
 * Ensures attackers cannot bypass IP rate limits or poison logs by sending
 * arbitrary forged `X-Forwarded-For` headers.
 */

// Loopback addresses
const LOOPBACK_IPS = new Set(["127.0.0.1", "::1", "localhost"]);

export function isLoopbackIp(ip: string): boolean {
  return LOOPBACK_IPS.has(ip.trim().toLowerCase());
}

/**
 * Checks whether an IP belongs to private RFC 1918 or RFC 4193 internal subnets.
 */
export function isPrivateSubnet(ip: string): boolean {
  if (!isValidIp(ip)) return false;

  // 10.0.0.0/8
  if (ip.startsWith("10.")) return true;

  // 172.16.0.0/12
  if (ip.startsWith("172.")) {
    const secondOctet = parseInt(ip.split(".")[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }

  // 192.168.0.0/16
  if (ip.startsWith("192.168.")) return true;

  // 127.0.0.0/8 loopback
  if (ip.startsWith("127.")) return true;

  // IPv6 ULA (fc00::/7) or loopback
  if (ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd") || ip === "::1") {
    return true;
  }

  return false;
}

/**
 * Evaluates whether an incoming request passed through a trusted Edge proxy (Vercel, Cloudflare)
 * or local testing environment.
 */
export function isTrustedEdgeRequest(headers: Headers | { get(name: string): string | null }): boolean {
  // Vercel edge injects tamper-proof x-vercel-forwarded-for or x-vercel-id
  if (headers.get("x-vercel-id") || headers.get("x-vercel-forwarded-for")) {
    return true;
  }

  // Cloudflare edge injects cf-ray and cf-connecting-ip
  if (headers.get("cf-ray") && headers.get("cf-connecting-ip")) {
    return true;
  }

  return false;
}

/**
 * Extracts and strictly verifies the client IP against trusted proxy headers.
 */
export function extractVerifiedClientIp(headers: Headers | { get(name: string): string | null }): {
  clientIp: string;
  isTrustedEdge: boolean;
  isPrivateSubnet: boolean;
} {
  const isTrustedEdge = isTrustedEdgeRequest(headers);

  // 1. If arriving from Vercel Edge, x-vercel-forwarded-for is verified by the ingress edge
  const vercelIp = headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    const first = vercelIp.split(",")[0].trim();
    if (isValidIp(first)) {
      return { clientIp: first, isTrustedEdge: true, isPrivateSubnet: isPrivateSubnet(first) };
    }
  }

  // 2. Cloudflare CF-Connecting-IP
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) {
    const trimmed = cfIp.trim();
    if (isValidIp(trimmed)) {
      return { clientIp: trimmed, isTrustedEdge: true, isPrivateSubnet: isPrivateSubnet(trimmed) };
    }
  }

  // 3. Fallback to X-Forwarded-For (take the outermost client IP only if well-formed)
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((s) => s.trim());
    for (const ip of ips) {
      if (isValidIp(ip)) {
        return { clientIp: ip, isTrustedEdge, isPrivateSubnet: isPrivateSubnet(ip) };
      }
    }
  }

  // 4. Default loopback
  return { clientIp: "127.0.0.1", isTrustedEdge: false, isPrivateSubnet: true };
}
