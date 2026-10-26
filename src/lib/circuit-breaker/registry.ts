import { CircuitBreaker } from "./circuit-breaker.ts";
import type { CircuitBreakerStats, CircuitBreakerOptions } from "./types.ts";

const circuitRegistry = new Map<string, CircuitBreaker>();

// Default configuration presets tailored to enterprise dependencies
const DEFAULT_PRESETS: Record<string, CircuitBreakerOptions> = {
  neon_db: { failureThreshold: 5, recoveryTimeMs: 5000 },
  oauth_idp: { failureThreshold: 3, recoveryTimeMs: 10000 },
  object_storage: { failureThreshold: 4, recoveryTimeMs: 8000 },
  redis_cache: { failureThreshold: 3, recoveryTimeMs: 5000 },
};

/**
 * Retrieves or lazily initializes a named circuit breaker instance.
 */
export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  let breaker = circuitRegistry.get(name);
  if (!breaker) {
    const config = options || DEFAULT_PRESETS[name] || { failureThreshold: 5, recoveryTimeMs: 10000 };
    breaker = new CircuitBreaker(name, config);
    circuitRegistry.set(name, breaker);
  }
  return breaker;
}

export function getAllCircuitStats(): Record<string, CircuitBreakerStats> {
  const result: Record<string, CircuitBreakerStats> = {};
  for (const [name, breaker] of circuitRegistry.entries()) {
    result[name] = breaker.getStats();
  }
  return result;
}

export function resetAllCircuits(): void {
  for (const breaker of circuitRegistry.values()) {
    breaker.reset();
  }
}
