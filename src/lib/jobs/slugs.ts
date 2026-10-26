export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateStableJobId(company: string, role: string, rawJobId?: string): {
  id: string;
  slug: string;
} {
  const companySlug = slugify(company);
  const roleSlug = slugify(role);

  const id = rawJobId
    ? `job_${companySlug}_${slugify(rawJobId)}`
    : `job_${companySlug}_${roleSlug}`;

  const slug = rawJobId
    ? `${roleSlug}-${companySlug}-${slugify(rawJobId)}`
    : `${roleSlug}-${companySlug}`;

  return { id, slug };
}
