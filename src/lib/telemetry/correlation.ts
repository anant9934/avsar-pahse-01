import { randomUUID } from "node:crypto";
import type { TraceContext, Span } from "./types.ts";

// Regex ensuring safe, sanitized correlation ID format
const SAFE_ID_REGEX = /^[a-zA-Z0-9_\-.]{8,64}$/;

/**
 * Extracts an existing correlation identifier from incoming request headers
 * (e.g. X-Request-ID, X-Trace-ID, X-Vercel-Id, or W3C traceparent),
 * or generates a fresh cryptographically random trace context.
 */
export function extractOrCreateTraceContext(
  request?: Request | { headers: Headers }
): TraceContext {
  let traceId = "";

  if (request?.headers) {
    const headerId =
      request.headers.get("x-request-id") ||
      request.headers.get("x-trace-id") ||
      request.headers.get("x-vercel-id");

    if (headerId) {
      const sanitized = headerId.trim();
      if (SAFE_ID_REGEX.test(sanitized)) {
        traceId = sanitized;
      }
    }
  }

  if (!traceId) {
    traceId = randomUUID();
  }

  return {
    traceId,
    spanId: randomUUID().slice(0, 16),
    startTime: performance.now(),
  };
}

/**
 * Injects correlation identifiers into outgoing response or downstream fetch headers.
 */
export function injectTraceHeaders(
  headers: Headers,
  context: TraceContext
): void {
  headers.set("X-Request-ID", context.traceId);
  headers.set("X-Trace-ID", context.traceId);
}

/**
 * Formats a list of completed spans into an RFC-compliant W3C Server-Timing header string.
 * Example: "db;dur=12.4, cache;dur=0.8, app;dur=3.2"
 */
export function formatServerTiming(spans: Span[]): string {
  if (!spans || spans.length === 0) return "";

  return spans
    .filter((s) => typeof s.durationMs === "number")
    .map((s) => `${s.name.replace(/[^a-zA-Z0-9_-]/g, "_")};dur=${s.durationMs!.toFixed(1)}`)
    .join(", ");
}
