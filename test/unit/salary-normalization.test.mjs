import test from "node:test";
import assert from "node:assert/strict";
import { formatCompensation } from "../../src/lib/jobs/salary.ts";

test("Unit: formatCompensation parses structured stipend ranges", () => {
  const result = formatCompensation(null, { min: 40000, max: 60000, currency: "INR", period: "month" }, null, null);
  assert.equal(result.compensation, "₹40,000 - ₹60,000/month");
  assert.equal(result.salaryDetails?.min, 40000);
  assert.equal(result.salaryDetails?.max, 60000);
});

test("Unit: formatCompensation parses structured CTC claims into LPA format", () => {
  const result = formatCompensation(null, null, { min: 800000, max: 1200000, currency: "INR", period: "year" }, null);
  assert.equal(result.compensation, "₹8 - ₹12 LPA");
  assert.equal(result.ctcClaim?.min, 800000);
});

test("Unit: formatCompensation handles raw string claims gracefully", () => {
  const result = formatCompensation("12 LPA verified by recruiter", null, null, null);
  assert.equal(result.compensation, "12 LPA verified by recruiter");
  assert.equal(result.salaryDetails?.rawClaim, "12 LPA verified by recruiter");
});
