import { getCircuitBreaker, getAllCircuitStats, resetAllCircuits } from "./registry.ts";
import type { CircuitState, CircuitBreakerStats, CircuitBreakerOptions } from "./types.ts";

/**
 * Functional convenience wrapper to execute an asynchronous task
 * protected by a named circuit breaker.
 */
export async function executeWithBreaker<T>(
  circuitName: string,
  operation: () => Promise<T>,
  fallback?: () => Promise<T> | T,
  options?: CircuitBreakerOptions
): Promise<T> {
  const breaker = getCircuitBreaker(circuitName, options);
  return breaker.execute<T>(operation, fallback);
}

export function getCircuitState(circuitName: string): CircuitState {
  return getCircuitBreaker(circuitName).getState();
}

export function getCircuitStats(circuitName: string): CircuitBreakerStats {
  return getCircuitBreaker(circuitName).getStats();
}

export function resetCircuit(circuitName: string): void {
  getCircuitBreaker(circuitName).reset();
}

export { getAllCircuitStats, resetAllCircuits };
export * from "./types.ts";
export * from "./circuit-breaker.ts";
export * from "./registry.ts";
