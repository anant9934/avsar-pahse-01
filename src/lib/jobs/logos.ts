export function normalizeCompanyLogoKey(company: string): string {
  const c = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (c.includes("google")) return "google";
  if (c.includes("tatadigital") || c.includes("tata")) return "tatadigital";
  if (c.includes("flipkart")) return "flipkart";
  if (c.includes("zoho")) return "zoho";
  if (c.includes("swiggy")) return "swiggy";
  if (c.includes("barclays")) return "barclays";
  if (c.includes("siemens")) return "siemens";
  if (c.includes("amazon")) return "amazon";
  if (c.includes("deloitte")) return "deloitte";
  if (c.includes("pwc")) return "pwc";
  if (c.includes("walmart")) return "walmart";
  if (c.includes("accenture")) return "accenture";
  if (c.includes("cognizant")) return "cognizant";
  return "default";
}
