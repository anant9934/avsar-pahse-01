import type { FeatureFlag } from "./types.ts";

/**
 * Authoritative production feature flags configuration
 */
export const DEFAULT_FEATURE_FLAGS: Record<string, FeatureFlag> = {
  maintenance_mode: {
    key: "maintenance_mode",
    description: "Global platform maintenance mode; freezes write operations during migrations",
    enabled: false,
    strategy: "boolean",
    defaultValue: false,
  },
  enhanced_match_score_v2: {
    key: "enhanced_match_score_v2",
    description: "Canary rollout of ERIS match scoring algorithm v2",
    enabled: true,
    strategy: "percentage",
    percentage: 25, // 25% canary rollout
    defaultValue: false,
  },
  campus_placement_fast_track: {
    key: "campus_placement_fast_track",
    description: "Exclusive expedited application review for verified campus student domains",
    enabled: true,
    strategy: "campus_targeted",
    allowedDomains: [".ac.in", ".edu.in"],
    defaultValue: false,
  },
  instant_resume_preview: {
    key: "instant_resume_preview",
    description: "In-browser PDF stream preview with presigned download URLs",
    enabled: true,
    strategy: "boolean",
    defaultValue: true,
  },
};

// In-memory runtime overrides (for testing, emergency kill-switches, and local testing)
const flagOverrides = new Map<string, Partial<FeatureFlag>>();

/**
 * Resolves a feature flag by key, applying environment variable overrides and runtime overrides.
 */
export function getFeatureFlag(key: string): FeatureFlag | null {
  const baseFlag = DEFAULT_FEATURE_FLAGS[key];
  if (!baseFlag && !flagOverrides.has(key)) {
    return null;
  }

  const result: FeatureFlag = {
    ...(baseFlag || {
      key,
      description: "Dynamically registered flag",
      enabled: false,
      strategy: "boolean",
      defaultValue: false,
    }),
  };

  // 1. Check environment variable overrides (e.g. FEATURE_FLAG_MAINTENANCE_MODE=true)
  const envKey = `FEATURE_FLAG_${key.toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal !== undefined) {
    result.enabled = envVal.toLowerCase() === "true" || envVal === "1";
  }

  const envPercentageKey = `FEATURE_FLAG_${key.toUpperCase()}_PERCENTAGE`;
  const envPercentageVal = process.env[envPercentageKey];
  if (envPercentageVal !== undefined) {
    const parsedPercentage = parseInt(envPercentageVal, 10);
    if (!isNaN(parsedPercentage)) {
      result.percentage = parsedPercentage;
      result.strategy = "percentage";
    }
  }

  // 2. Check in-memory runtime overrides
  const override = flagOverrides.get(key);
  if (override) {
    Object.assign(result, override);
  }

  return result;
}

/**
 * Retrieves all registered feature flags with active overrides.
 */
export function getAllRegisteredFlags(): Record<string, FeatureFlag> {
  const flags: Record<string, FeatureFlag> = {};
  for (const key of Object.keys(DEFAULT_FEATURE_FLAGS)) {
    const flag = getFeatureFlag(key);
    if (flag) {
      flags[key] = flag;
    }
  }
  return flags;
}

/**
 * Sets a runtime override for testing or emergency intervention.
 */
export function setFlagOverride(key: string, override: Partial<FeatureFlag> | boolean): void {
  if (typeof override === "boolean") {
    flagOverrides.set(key, { enabled: override });
  } else {
    flagOverrides.set(key, override);
  }
}

/**
 * Clears all active runtime overrides.
 */
export function clearFlagOverrides(): void {
  flagOverrides.clear();
}
