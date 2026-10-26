/**
 * Enterprise observability, tracing, and metric collection types.
 */

export interface TraceContext {
  /** Unique request trace correlation identifier */
  traceId: string;
  /** Optional parent span identifier for distributed call graphs */
  parentSpanId?: string;
  /** Active span identifier */
  spanId: string;
  /** Request start timestamp in fractional milliseconds */
  startTime: number;
}

export interface Span {
  name: string;
  traceId: string;
  spanId: string;
  startTime: number;
  durationMs?: number;
  attributes?: Record<string, string | number | boolean>;
}

export interface MetricSnapshot {
  name: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  recentRps: number;
}

export interface TelemetryEvent {
  eventType: "http_request" | "db_query" | "cache_op" | "job_exec";
  timestamp: string;
  traceId: string;
  durationMs: number;
  status: "success" | "error";
  details?: Record<string, unknown>;
}
