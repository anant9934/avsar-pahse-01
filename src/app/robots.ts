import type { MetadataRoute } from "next";
import { resolveDeploymentBaseUrl } from "@/lib/auth/aitathastu";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = resolveDeploymentBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/explore", "/welcome", "/home", "/jobs/"],
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/profile",
          "/profile/",
          "/applications",
          "/applications/",
          "/auth",
          "/auth/",
          "/saved",
          "/saved/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
