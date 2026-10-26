import type { SalaryDetails } from "../../types/index.ts";

export function formatCompensation(
  salary: unknown,
  stipend: unknown,
  ctcClaim: unknown,
  salaryClaim: unknown,
  defaultCurrency = "INR"
): { compensation: string; salaryDetails?: SalaryDetails; ctcClaim?: SalaryDetails } {
  let primaryDetails: SalaryDetails | undefined;
  let formattedCtc: SalaryDetails | undefined;

  // 1. Structured stipend (e.g. from Block 2)
  if (stipend && typeof stipend === "object") {
    const s = stipend as { min?: number; max?: number; currency?: string; period?: string };
    const curSymbol = s.currency === "INR" || !s.currency ? "₹" : `${s.currency} `;
    const periodStr = s.period ? `/${s.period}` : "/month";
    primaryDetails = {
      min: s.min,
      max: s.max,
      currency: s.currency || defaultCurrency,
      period: s.period || "month",
    };
    if (s.min && s.max && s.min === s.max) {
      return {
        compensation: `${curSymbol}${s.min.toLocaleString("en-IN")}${periodStr}`,
        salaryDetails: primaryDetails,
      };
    } else if (s.min && s.max) {
      return {
        compensation: `${curSymbol}${s.min.toLocaleString("en-IN")} - ${curSymbol}${s.max.toLocaleString("en-IN")}${periodStr}`,
        salaryDetails: primaryDetails,
      };
    }
  }

  // 2. Structured CTC claim (e.g. year period)
  if (ctcClaim && typeof ctcClaim === "object") {
    const c = ctcClaim as { min?: number; max?: number; currency?: string; period?: string };
    formattedCtc = {
      min: c.min,
      max: c.max,
      currency: c.currency || defaultCurrency,
      period: c.period || "year",
    };
    const minLPA = c.min ? c.min / 100000 : undefined;
    const maxLPA = c.max ? c.max / 100000 : undefined;
    let label = "Competitive CTC";
    if (minLPA && maxLPA && minLPA === maxLPA) {
      label = `₹${minLPA} LPA`;
    } else if (minLPA && maxLPA) {
      label = `₹${minLPA} - ₹${maxLPA} LPA`;
    } else if (minLPA) {
      label = `₹${minLPA}+ LPA`;
    }
    return {
      compensation: label,
      salaryDetails: formattedCtc,
      ctcClaim: formattedCtc,
    };
  }

  // 3. Structured salary claim (e.g. monthly range claim)
  if (salaryClaim && typeof salaryClaim === "object") {
    const sc = salaryClaim as { min?: number; max?: number; currency?: string; period?: string };
    const curSymbol = sc.currency === "INR" || !sc.currency ? "₹" : `${sc.currency} `;
    const periodStr = sc.period ? `/${sc.period}` : "/month";
    primaryDetails = {
      min: sc.min,
      max: sc.max,
      currency: sc.currency || defaultCurrency,
      period: sc.period || "month",
      rawClaim: "Source unverified salary range",
    };
    if (sc.min && sc.max && sc.min === sc.max) {
      return {
        compensation: `${curSymbol}${sc.min.toLocaleString("en-IN")}${periodStr}`,
        salaryDetails: primaryDetails,
      };
    } else if (sc.min && sc.max) {
      return {
        compensation: `${curSymbol}${sc.min.toLocaleString("en-IN")} - ${curSymbol}${sc.max.toLocaleString("en-IN")}${periodStr}`,
        salaryDetails: primaryDetails,
      };
    }
  }

  // 4. Raw string claim from source
  if (typeof salary === "string" && salary.trim()) {
    return {
      compensation: salary.trim(),
      salaryDetails: { rawClaim: salary.trim() },
    };
  }

  // 5. Default when no salary or null
  return {
    compensation: "Competitive / Disclosed on Application",
  };
}
