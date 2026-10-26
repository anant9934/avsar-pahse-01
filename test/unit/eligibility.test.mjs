import test from "node:test";
import assert from "node:assert/strict";
import { evaluateEligibility } from "../../src/lib/matching/eligibility.ts";

test("Unit: evaluateEligibility approves candidate with matching graduation year", () => {
  const candidate = {
    education: [{ endYear: "2025" }],
  };
  const job = {
    graduationYears: [2024, 2025],
  };

  const result = evaluateEligibility(candidate as any, job as any);
  assert.equal(result.isEligible, true);
  assert.ok(result.reason.includes("2025"));
});

test("Unit: evaluateEligibility flags warning for mismatched graduation batch", () => {
  const candidate = {
    education: [{ endYear: "2023" }],
  };
  const job = {
    graduationYears: [2025, 2026],
  };

  const result = evaluateEligibility(candidate as any, job as any);
  assert.equal(result.isEligible, false);
  assert.ok(result.reason.includes("2023"));
});
