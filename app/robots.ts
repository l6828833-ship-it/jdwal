import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

/**
 * Served at /robots.txt. Allows all crawlers and points them at the sitemap.
 * The API routes are disallowed — they return JSON, not pages to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
