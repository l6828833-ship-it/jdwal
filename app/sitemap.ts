import type { MetadataRoute } from "next";
import { POPULAR_LEAGUES, SITE_URL } from "@/lib/config";

/**
 * Served at /sitemap.xml, submitted to Google Search Console.
 *
 * Two kinds of URL are listed, and one kind is deliberately absent.
 *
 * The fixed section pages carry the "جدول مباريات" / "jdwal" intent that ranking
 * targets. The pinned league pages are listed too: each is a stable URL with
 * substantial, distinct content (a full table, that competition's fixtures, its
 * scorers) and a real search term behind it — "ترتيب الدوري الإنجليزي" is looked
 * up far more than the homepage's terms, and those queries can only land on a
 * league page. There are a few dozen of them, they change identity never, and
 * they are the site's main long-tail surface, so omitting them was leaving the
 * bulk of the site invisible to a crawler that only reads the sitemap.
 *
 * Individual MATCH pages stay out, matching the `noindex` they already declare
 * in app/match/[id]/page.tsx: ~300 new URLs a day, each near-duplicate and
 * disposable within days, which would spend crawl budget and dilute the site's
 * quality signal.
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

  /**
   * League pages, in the order POPULAR_LEAGUES pins them — which is already an
   * editorial ranking (World Cup and the European cups first, then the big five,
   * then the Arab leagues), so it maps straight onto sitemap priority. Priority
   * decays with position but never below 0.4, since even the last entry is a
   * real competition page and not filler.
   */
  const leaguePages = POPULAR_LEAGUES.map((league, index) =>
    page(
      `/league/${league.apiFootballId}`,
      Math.max(0.4, 0.75 - index * 0.01),
      "daily",
    ),
  );

  return [
    // The home fixture list turns over through the day; the rest change as
    // results and leaderboards update, but not by the hour.
    page("/", 1, "daily"),
    // The match section's only indexable URL: the match pages under it are
    // noindex by design, so this index is what represents them.
    page("/match", 0.9, "daily"),
    page("/leagues", 0.8, "weekly"),
    page("/scorers", 0.7, "daily"),
    page("/players", 0.5, "weekly"),
    ...leaguePages,
  ];
}
