import {
  CircuitBreakerOpenError,
  type CircuitState,
  type CircuitBreakerOptions,
  type CircuitBreakerStats,
} from "./types.ts";

/**
 * Three-state circuit breaker (Closed, Open, Half-Open) to protect
 * downstream serverless infrastructure from cascading resource exhaustion.
 */
export class CircuitBreaker {
  readonly name: string;
  private state: CircuitState = "closed";
  private consecutiveFailures = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  private failureThreshold: number;
  private recoveryTimeMs: number;

  constructor(name: string, options?: CircuitBreakerOptions) {
    this.name = name;
    this.failureThreshold = options?.failureThreshold || 5;
    this.recoveryTimeMs = options?.recoveryTimeMs || 10000;
  }

  getState(): CircuitState {
    if (this.state === "open" && Date.now() >= this.nextAttemptTime) {
      this.state = "half_open";
    }
    return this.state;
  }

  /**
   * Executes an asynchronous operation wrapped with circuit breaker protection.
   * If the circuit is open, fast-fails immediately without attempting downstream I/O.
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    const currentState = this.getState();

    if (currentState === "open") {
      const remainingMs = Math.max(0, this.nextAttemptTime - Date.now());
      if (fallback) {
        return await fallback();
      }
      throw new CircuitBreakerOpenError(this.name, remainingMs);
    }

    try {
      const result = await operation();
      this.handleSuccess();
      return result;
    } catch (err) {
      this.handleFailure();
      if (fallback) {
        return await fallback();
      }
      throw err;
    }
  }

  private handleSuccess(): void {
    this.totalSuccesses++;
    if (this.state === "half_open") {
      // Successful probe in half-open state: recover circuit to closed
      this.state = "closed";
      this.consecutiveFailures = 0;
    } else if (this.consecutiveFailures > 0) {
      this.consecutiveFailures = 0;
    }
  }

  private handleFailure(): void {
    this.consecutiveFailures++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === "half_open" || this.consecutiveFailures >= this.failureThreshold) {
      this.state = "open";
      this.nextAttemptTime = Date.now() + this.recoveryTimeMs;
    }
  }

  getStats(): CircuitBreakerStats {
    return {
      name: this.name,
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastFailureTime: this.lastFailureTime || undefined,
      nextAttemptTime: this.state === "open" ? this.nextAttemptTime : undefined,
    };
  }

  /**
   * Manually resets the circuit breaker back to healthy closed state.
   */
  reset(): void {
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }
}
