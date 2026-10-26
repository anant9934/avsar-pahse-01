export interface SalaryDetails {
  min?: number;
  max?: number;
  currency?: string;
  period?: "month" | "year" | "week" | string;
  rawClaim?: string;
}

export function isSalaryDetails(obj: unknown): obj is SalaryDetails {
  return (
    typeof obj === "object" &&
    obj !== null &&
    ("min" in obj || "max" in obj || "rawClaim" in obj)
  );
}
