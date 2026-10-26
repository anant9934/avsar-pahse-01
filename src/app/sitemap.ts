import type { MetadataRoute } from "next";
import { resolveDeploymentBaseUrl } from "../lib/auth/aitathastu.ts";
import { getJobRepository } from "../lib/repository/index.ts";

function parseValidDate(dateStr?: string | null, fallback: Date = new Date()): Date {
  if (!dateStr || typeof dateStr !== "string") return fallback;
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = resolveDeploymentBaseUrl();
  const now = new Date();

  // Core public discovery routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/home`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/welcome`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // Dynamically include active job postings
  try {
    const jobRepo = getJobRepository();
    const { jobs } = await jobRepo.list({ limit: 50 });
    const jobRoutes: MetadataRoute.Sitemap = jobs.map((job) => ({
      url: `${baseUrl}/jobs/${job.id}`,
      lastModified: parseValidDate(job.postedAt, now),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    return [...staticRoutes, ...jobRoutes];
  } catch (err) {
    console.warn("[Sitemap] Could not query job repository for dynamic sitemap:", err);
    return staticRoutes;
  }
}
