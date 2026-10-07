import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { BLOCKED_BOTS } from "@/lib/bots";

/**
 * Served at /robots.txt. Search engines are allowed and pointed at the sitemap;
 * the API routes are disallowed (they return JSON, not pages to index).
 *
 * AI scrapers and SEO crawlers are disallowed outright: they send no visitors
 * and every page they fetch costs a backend call. Bots that ignore this file
 * are also refused with a 403 in proxy.ts.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: BLOCKED_BOTS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: "/api/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
