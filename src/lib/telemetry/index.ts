import { MetricsCollector } from "./metrics.ts";
import { HighResolutionTimer } from "./timer.ts";
import type { TraceContext, MetricSnapshot } from "./types.ts";

let globalMetricsCollector: MetricsCollector | null = null;

/**
 * Returns the active metrics collector singleton.
 */
export function getMetricsCollector(): MetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new MetricsCollector();
  }
  return globalMetricsCollector;
}

/**
 * Records an execution duration sample in milliseconds.
 */
export function recordMetric(name: string, durationMs: number): void {
  getMetricsCollector().recordDuration(name, durationMs);
}

/**
 * Returns snapshot of percentiles and throughput for a metric name.
 */
export function getMetricSnapshot(name: string): MetricSnapshot {
  return getMetricsCollector().getSnapshot(name);
}

/**
 * Returns all recorded metric snapshots.
 */
export function getAllMetricSnapshots(): Record<string, MetricSnapshot> {
  return getMetricsCollector().getAllSnapshots();
}

/**
 * Creates a high-resolution timer instance initialized with trace context.
 */
export function createTimer(context?: TraceContext): HighResolutionTimer {
  return new HighResolutionTimer(context);
}

/**
 * Reset telemetry state for unit test isolation.
 */
export function resetTelemetryForTesting(): void {
  if (globalMetricsCollector) {
    globalMetricsCollector.reset();
  }
}

export * from "./types.ts";
export * from "./correlation.ts";
export * from "./timer.ts";
export * from "./metrics.ts";
