import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  isFeatureEnabled,
  evaluateFlag,
  getAllFlagsStatus,
  setFlagOverride,
  clearFlagOverrides,
} from "../src/lib/flags/index.ts";
import { getDeterministicBucket } from "../src/lib/flags/evaluator.ts";

describe("Feature Flags & Dynamic Canary Rollout Framework", () => {
  beforeEach(() => {
    clearFlagOverrides();
    delete process.env.FEATURE_FLAG_MAINTENANCE_MODE;
    delete process.env.FEATURE_FLAG_ENHANCED_MATCH_SCORE_V2_PERCENTAGE;
  });

  it("evaluates default registered boolean flags", () => {
    assert.equal(isFeatureEnabled("instant_resume_preview"), true);
    assert.equal(isFeatureEnabled("maintenance_mode"), false);
  });

  it("enforces global kill switch regardless of strategy", () => {
    setFlagOverride("test_flag", {
      key: "test_flag",
      description: "Test",
      enabled: false,
      strategy: "boolean",
      defaultValue: true,
    });

    const res = evaluateFlag("test_flag", {});
    assert.equal(res.enabled, false);
    assert.equal(res.reason, "GLOBAL_KILL_SWITCH");
  });

  it("evaluates explicit candidate allowlists", () => {
    setFlagOverride("beta_feature", {
      key: "beta_feature",
      description: "Beta feature for select candidates",
      enabled: true,
      strategy: "allowlist",
      allowedCandidateIds: ["cand_rohan_001", "cand_vip_002"],
      defaultValue: false,
    });

    assert.equal(isFeatureEnabled("beta_feature", { candidateId: "cand_rohan_001" }), true);
    assert.equal(isFeatureEnabled("beta_feature", { candidateId: "cand_vip_002" }), true);
    assert.equal(isFeatureEnabled("beta_feature", { candidateId: "cand_other_003" }), false);
    assert.equal(isFeatureEnabled("beta_feature", {}), false);
  });

  it("evaluates campus educational domain targeting", () => {
    assert.equal(
      isFeatureEnabled("campus_placement_fast_track", { email: "student@iitb.ac.in" }),
      true
    );
    assert.equal(
      isFeatureEnabled("campus_placement_fast_track", { email: "placement@nitk.edu.in" }),
      true
    );
    assert.equal(
      isFeatureEnabled("campus_placement_fast_track", { email: "applicant@gmail.com" }),
      false
    );
    assert.equal(
      isFeatureEnabled("campus_placement_fast_track", {}),
      false
    );
  });

  it("ensures deterministic hash bucketing without user flapping", () => {
    const candidateId = "cand_consistent_user_999";
    const bucket1 = getDeterministicBucket("enhanced_match_score_v2", candidateId);

    // Run 100 consecutive evaluations to prove determinism
    for (let i = 0; i < 100; i++) {
      const bucketN = getDeterministicBucket("enhanced_match_score_v2", candidateId);
      assert.equal(bucketN, bucket1);
    }

    assert.ok(bucket1 >= 0 && bucket1 < 100);
  });

  it("evaluates percentage canary rollouts monotonically", () => {
    setFlagOverride("canary_feature", {
      key: "canary_feature",
      description: "Canary rollout",
      enabled: true,
      strategy: "percentage",
      percentage: 50,
      defaultValue: false,
    });

    let enabledCount = 0;
    const totalUsers = 200;

    for (let i = 0; i < totalUsers; i++) {
      const candId = `test_candidate_${i}`;
      if (isFeatureEnabled("canary_feature", { candidateId: candId })) {
        enabledCount++;
      }
    }

    // With 200 uniform hashes at 50%, expect roughly 40%-60%
    const ratio = enabledCount / totalUsers;
    assert.ok(ratio >= 0.35 && ratio <= 0.65, `Actual ratio ${ratio} was outside expected distribution`);
  });

  it("handles 0% and 100% boundary conditions", () => {
    setFlagOverride("zero_flag", {
      key: "zero_flag",
      description: "Zero",
      enabled: true,
      strategy: "percentage",
      percentage: 0,
    });
    assert.equal(isFeatureEnabled("zero_flag", { candidateId: "any_cand" }), false);

    setFlagOverride("hundred_flag", {
      key: "hundred_flag",
      description: "Hundred",
      enabled: true,
      strategy: "percentage",
      percentage: 100,
    });
    assert.equal(isFeatureEnabled("hundred_flag", { candidateId: "any_cand" }), true);
  });

  it("respects environment variable overrides", () => {
    process.env.FEATURE_FLAG_MAINTENANCE_MODE = "true";
    assert.equal(isFeatureEnabled("maintenance_mode"), true);

    process.env.FEATURE_FLAG_MAINTENANCE_MODE = "false";
    assert.equal(isFeatureEnabled("maintenance_mode"), false);
  });

  it("returns comprehensive evaluation map across all flags", () => {
    const statuses = getAllFlagsStatus({ email: "student@iitb.ac.in" });

    assert.ok(typeof statuses.instant_resume_preview === "boolean");
    assert.ok(typeof statuses.maintenance_mode === "boolean");
    assert.equal(statuses.campus_placement_fast_track, true);
  });
});
