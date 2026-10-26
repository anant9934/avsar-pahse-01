/**
 * Feature Flag & Dynamic Rollout Type Definitions
 */

export type RolloutStrategy = "boolean" | "percentage" | "allowlist" | "campus_targeted";

export interface FeatureFlag {
  key: string;
  description: string;
  enabled: boolean;
  strategy: RolloutStrategy;
  percentage?: number; // 0 to 100 for gradual canary rollouts
  allowedCandidateIds?: string[];
  allowedDomains?: string[]; // e.g. ["@iitb.ac.in", "@nitk.edu.in"]
  defaultValue?: boolean;
}

export interface FlagContext {
  candidateId?: string | null;
  email?: string | null;
  ip?: string | null;
  environment?: string;
}

export interface FlagEvaluationResult {
  key: string;
  enabled: boolean;
  reason: string;
}
