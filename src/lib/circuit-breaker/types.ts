/**
 * High-concurrency circuit breaker state machine types and options.
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerOptions {
  /** Failure count threshold within the rolling window to trip the breaker */
  failureThreshold?: number;
  /** Cooldown time in milliseconds before transitioning from open to half-open */
  recoveryTimeMs?: number;
  /** Window duration in milliseconds for tracking consecutive failures */
  samplingWindowMs?: number;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

export class CircuitBreakerOpenError extends Error {
  readonly circuitName: string;
  readonly retryAfterMs: number;

  constructor(circuitName: string, retryAfterMs: number) {
    super(`Circuit breaker [${circuitName}] is OPEN. Fast-failing downstream call.`);
    this.name = "CircuitBreakerOpenError";
    this.circuitName = circuitName;
    this.retryAfterMs = retryAfterMs;
  }
}
