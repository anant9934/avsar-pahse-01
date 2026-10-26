import { randomUUID } from "node:crypto";
import type { Span, TraceContext } from "./types.ts";

/**
 * Microsecond-resolution timer and span recorder.
 * Enables zero-overhead execution profiling inside serverless request invocations.
 */
export class HighResolutionTimer {
  private spans: Span[] = [];
  private traceContext: TraceContext;

  constructor(context?: TraceContext) {
    this.traceContext = context || {
      traceId: randomUUID(),
      spanId: randomUUID().slice(0, 16),
      startTime: performance.now(),
    };
  }

  startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
    const span: Span = {
      name,
      traceId: this.traceContext.traceId,
      spanId: randomUUID().slice(0, 16),
      startTime: performance.now(),
      attributes,
    };
    this.spans.push(span);
    return span;
  }

  endSpan(span: Span): number {
    const duration = parseFloat((performance.now() - span.startTime).toFixed(2));
    span.durationMs = duration;
    return duration;
  }

  async timeAsync<T>(
    name: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<{ result: T; durationMs: number }> {
    const span = this.startSpan(name, attributes);
    try {
      const result = await operation();
      const durationMs = this.endSpan(span);
      return { result, durationMs };
    } catch (err) {
      this.endSpan(span);
      throw err;
    }
  }

  getSpans(): Span[] {
    return [...this.spans];
  }

  getTotalDurationMs(): number {
    return parseFloat((performance.now() - this.traceContext.startTime).toFixed(2));
  }
}
