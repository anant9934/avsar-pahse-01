import crypto from "node:crypto";
import type { FeatureFlag, FlagContext, FlagEvaluationResult } from "./types.ts";

/**
 * Computes a deterministic integer bucket (0 to 99) from a key and entity identifier.
 * Uses SHA-256 to ensure uniform distribution and avoid flapping.
 */
export function getDeterministicBucket(flagKey: string, identifier: string): number {
  const hash = crypto.createHash("sha256").update(`${flagKey}:${identifier}`).digest("hex");
  // Take first 8 hex characters (32-bit unsigned int) and modulo 100
  const intVal = parseInt(hash.substring(0, 8), 16);
  return intVal % 100;
}

/**
 * Evaluates a feature flag against runtime context using defined rollout strategies.
 */
export function evaluateFeatureFlag(
  flag: FeatureFlag,
  context: FlagContext = {}
): FlagEvaluationResult {
  // 1. Global Kill Switch check
  if (!flag.enabled) {
    return {
      key: flag.key,
      enabled: false,
      reason: "GLOBAL_KILL_SWITCH",
    };
  }

  // 2. Strategy: Direct Boolean Toggle
  if (flag.strategy === "boolean") {
    return {
      key: flag.key,
      enabled: true,
      reason: "BOOLEAN_ENABLED",
    };
  }

  // 3. Strategy: Explicit Candidate Allowlist
  if (flag.strategy === "allowlist") {
    const candidateId = context.candidateId;
    if (candidateId && flag.allowedCandidateIds && flag.allowedCandidateIds.includes(candidateId)) {
      return {
        key: flag.key,
        enabled: true,
        reason: "ALLOWLIST_MATCH",
      };
    }
    return {
      key: flag.key,
      enabled: false,
      reason: "ALLOWLIST_NOT_MATCHED",
    };
  }

  // 4. Strategy: Campus Targeted (Educational Email Domain Matching)
  if (flag.strategy === "campus_targeted") {
    const email = context.email?.toLowerCase().trim();
    if (email && flag.allowedDomains && flag.allowedDomains.length > 0) {
      const isMatched = flag.allowedDomains.some((domain) =>
        email.endsWith(domain.toLowerCase().trim())
      );
      if (isMatched) {
        return {
          key: flag.key,
          enabled: true,
          reason: "CAMPUS_DOMAIN_MATCH",
        };
      }
    }
    return {
      key: flag.key,
      enabled: false,
      reason: "CAMPUS_DOMAIN_NOT_MATCHED",
    };
  }

  // 5. Strategy: Deterministic Percentage Canary Rollout
  if (flag.strategy === "percentage") {
    const targetPercentage = flag.percentage ?? 0;
    if (targetPercentage <= 0) {
      return {
        key: flag.key,
        enabled: false,
        reason: "PERCENTAGE_ZERO",
      };
    }
    if (targetPercentage >= 100) {
      return {
        key: flag.key,
        enabled: true,
        reason: "PERCENTAGE_HUNDRED",
      };
    }

    // Determine stable identifier (candidateId preferred, fallback to client IP or anonymous default)
    const identifier = context.candidateId || context.ip || "anonymous_caller";
    const bucket = getDeterministicBucket(flag.key, identifier);

    const isEnabled = bucket < targetPercentage;
    return {
      key: flag.key,
      enabled: isEnabled,
      reason: isEnabled
        ? `PERCENTAGE_INCLUDED (bucket ${bucket} < ${targetPercentage})`
        : `PERCENTAGE_EXCLUDED (bucket ${bucket} >= ${targetPercentage})`,
    };
  }

  // Fallback to flag's default value or false
  return {
    key: flag.key,
    enabled: flag.defaultValue ?? false,
    reason: "DEFAULT_FALLBACK",
  };
}
