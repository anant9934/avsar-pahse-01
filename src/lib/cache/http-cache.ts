import { createHash } from "node:crypto";

export interface CacheControlOptions {
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  isPrivate?: boolean;
  mustRevalidate?: boolean;
}

/**
 * Generates an RFC 7232 compliant weak ETag for an arbitrary payload.
 */
export function generateETag(payload: unknown): string {
  const content = typeof payload === "string" ? payload : JSON.stringify(payload);
  const hash = createHash("sha1").update(content).digest("hex").slice(0, 16);
  return `W/"${hash}"`;
}

/**
 * Checks if the request's If-None-Match header matches the given ETag.
 */
export function isNotModified(
  headers: Headers | { get(name: string): string | null },
  etag: string
): boolean {
  const ifNoneMatch = headers.get("if-none-match");
  if (!ifNoneMatch) return false;

  // Clean quotes or W/ prefix for normalized comparison
  const clean = (val: string) => val.replace(/^W\//, "").replace(/"/g, "").trim();
  const target = clean(etag);

  if (ifNoneMatch.trim() === "*") return true;

  const matches = ifNoneMatch.split(",").map(clean);
  return matches.includes(target);
}

/**
 * Builds standard Cache-Control directives for CDN / Edge and browser caching.
 */
export function buildCacheControlHeader(options: CacheControlOptions = {}): string {
  if (options.isPrivate) {
    return "private, no-cache, no-store, must-revalidate";
  }

  const directives: string[] = ["public"];

  if (typeof options.maxAge === "number") {
    directives.push(`max-age=${options.maxAge}`);
  } else {
    directives.push("max-age=0");
  }

  if (typeof options.sMaxAge === "number") {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }

  if (typeof options.staleWhileRevalidate === "number") {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.mustRevalidate) {
    directives.push("must-revalidate");
  }

  return directives.join(", ");
}
