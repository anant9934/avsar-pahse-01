import { extractVerifiedClientIp } from "./trusted-proxies.ts";

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
export function resolveClientIp(request: Request | { headers: Headers }): string {
  const { clientIp } = extractVerifiedClientIp(request.headers);
  return clientIp;
}

export interface RateLimitSubject {
  subject: string;
  type: "candidate" | "ip";
  clientIp: string;
  isTrustedEdge: boolean;
  isCampusNat: boolean;
}

/**
 * Resolves the appropriate rate-limiting subject for an incoming request.
 * Prioritizes authenticated candidate ID over raw client IP so students
 * sharing university campus Wi-Fi or carrier NAT gateways are not unfairly blocked.
 */
export function resolveRateLimitSubject(
  request: Request | { headers: Headers },
  candidateId?: string | null
): RateLimitSubject {
  const { clientIp, isTrustedEdge, isPrivateSubnet } = extractVerifiedClientIp(request.headers);

  if (candidateId && typeof candidateId === "string" && candidateId.trim() !== "") {
    return {
      subject: `cand:${candidateId.trim()}`,
      type: "candidate",
      clientIp,
      isTrustedEdge,
      isCampusNat: isPrivateSubnet,
    };
  }

  return {
    subject: `ip:${clientIp}`,
    type: "ip",
    clientIp,
    isTrustedEdge,
    isCampusNat: isPrivateSubnet,
  };
}
