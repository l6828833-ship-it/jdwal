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
  const page = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    // The home fixture list turns over through the day; the rest change as
    // results and leaderboards update, but not by the hour.
    page("/", 1, "daily"),
    page("/leagues", 0.8, "weekly"),
    page("/scorers", 0.7, "daily"),
    page("/players", 0.5, "weekly"),
  ];
}
