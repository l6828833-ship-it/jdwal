import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

/**
 * Served at /sitemap.xml, submitted to Google Search Console.
 *
 * Lists the stable, indexable pages. Dynamic pages (a specific match or a
 * specific league) are intentionally omitted: they number in the thousands,
 * change constantly, and add no keyword value — the fixed pages below carry the
 * "جدول مباريات" / "jdwal" intent that ranking targets.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "daily",
    priority,
  });

  return [
    page("/", 1),
    page("/leagues", 0.8),
    page("/scorers", 0.7),
    page("/players", 0.5),
  ];
}
