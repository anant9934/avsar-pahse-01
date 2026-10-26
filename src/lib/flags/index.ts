import { getFeatureFlag, getAllRegisteredFlags, setFlagOverride, clearFlagOverrides } from "./store.ts";
import { evaluateFeatureFlag } from "./evaluator.ts";
import type { FlagContext, FlagEvaluationResult, FeatureFlag, RolloutStrategy } from "./types.ts";

export type { FlagContext, FlagEvaluationResult, FeatureFlag, RolloutStrategy };
export { setFlagOverride, clearFlagOverrides };

/**
 * Checks if a specific feature flag is active for the given context.
 * Returns boolean immediately for convenient use in if-conditions and route handlers.
 */
export function isFeatureEnabled(key: string, context: FlagContext = {}): boolean {
  const flag = getFeatureFlag(key);
  if (!flag) {
    return false;
  }

  const result = evaluateFeatureFlag(flag, context);
  return result.enabled;
}

/**
 * Evaluates a feature flag and returns the full evaluation result including reason.
 */
export function evaluateFlag(key: string, context: FlagContext = {}): FlagEvaluationResult {
  const flag = getFeatureFlag(key);
  if (!flag) {
    return {
      key,
      enabled: false,
      reason: "FLAG_NOT_FOUND",
    };
  }

  return evaluateFeatureFlag(flag, context);
}

/**
 * Returns a map of all registered feature flags evaluated against the given context.
 */
export function getAllFlagsStatus(context: FlagContext = {}): Record<string, boolean> {
  const flags = getAllRegisteredFlags();
  const statusMap: Record<string, boolean> = {};

  for (const [key, flag] of Object.entries(flags)) {
    statusMap[key] = evaluateFeatureFlag(flag, context).enabled;
  }

  return statusMap;
}
