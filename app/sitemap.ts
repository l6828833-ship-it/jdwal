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
  const leaguePages = POPULAR_LEAGUES
    // Only competitions with an asserted provider id have a resolvable page.
    // A pinned entry without one (see the Gulf Cup in lib/config.ts) still ranks
    // by name on the fixture list, but has no URL to advertise yet — listing it
    // would put a 404 in the sitemap.
    .filter((league) => league.apiFootballId > 0)
    .map((league, index) =>
      page(
        `/league/${league.slug}`,
        Math.max(0.4, 0.75 - index * 0.01),
        "daily",
      ),
    );

  return [
    // The home fixture list turns over through the day; the rest change as
    // results and leaderboards update, but not by the hour.
    page("/", 1, "daily"),
    // `/match` is deliberately absent: it permanently redirects to `/` (see
    // next.config.ts). A sitemap should list only indexable canonical URLs, and
    // a redirecting entry is a quality signal Google reports against the site.
    page("/leagues", 0.8, "weekly"),
    page("/scorers", 0.7, "daily"),
    page("/players", 0.5, "weekly"),
    // Publisher transparency and original evergreen content. Privacy, cookies,
    // terms and disclaimer are deliberately absent because those pages declare
    // noindex,follow; a sitemap must contain only indexable canonical URLs.
    page("/about", 0.6, "monthly"),
    page("/contact", 0.4, "monthly"),
    page("/how-it-works", 0.65, "monthly"),
    page("/editorial-policy", 0.55, "monthly"),
    page("/guides/following-live-matches", 0.7, "monthly"),
    page("/guides/reading-standings", 0.7, "monthly"),
    ...leaguePages,
  ];
}
