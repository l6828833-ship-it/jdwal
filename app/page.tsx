import type { Metadata } from "next";
import { MatchesView } from "@/components/matches-view";
import { NavLink } from "@/components/nav-link";
import { getMatchesByDate, hasApiKey } from "@/lib/provider";
import { resolveRequestTime } from "@/lib/geo-timezone";
import { ApiKeyNotice, LoadErrorNotice, QuotaNotice } from "@/components/notices";
import { SITE_URL } from "@/lib/config";
import { classifyFailure, logFailure } from "@/lib/errors";
import { NOINDEX_FOLLOW, robotsFor } from "@/lib/seo";
import { t } from "@/lib/i18n";
import type { MatchesPayload } from "@/lib/types";

/**
 * Rendered per request: the fixture list changes through the day and while
 * matches are in progress. Upstream traffic is still bounded by the shared
 * cache in lib/cache.ts, so dynamic rendering does not mean a request per view.
 */
export const dynamic = "force-dynamic";

/**
 * Whether today's fixtures can be served right now.
 *
 * Called from `generateMetadata` as well as the page body, which costs nothing
 * extra: `getCached` coalesces concurrent calls for the same key and then serves
 * the entry, so both readers share one upstream request.
 */
async function fixturesAvailable(today: string): Promise<boolean> {
  try {
    const { matches } = await getMatchesByDate(today, today);
    return matches.length > 0;
  } catch {
    return false;
  }
}

/**
 * A render with no fixtures must not be indexed — see lib/seo.ts for the policy
 * and why it exists. This is the URL it was written for: the homepage is the
 * site's most valuable page, and it is the one whose Google result ended up
 * reading "تعذّر تحميل البيانات".
 */
export async function generateMetadata(): Promise<Metadata> {
  if (!hasApiKey()) return { robots: NOINDEX_FOLLOW };

  const { today } = await resolveRequestTime();

  return {
    alternates: { canonical: "/" },
    robots: robotsFor(await fixturesAvailable(today)),
  };
}

export default async function HomePage() {
  if (!hasApiKey()) {
    return <ApiKeyNotice />;
  }

  /**
   * "Today" must mean today where the VIEWER is, not where the server runs —
   * and it must be the real today, not whatever the host machine's clock says.
   *
   * `resolveRequestTime` settles both from the network: the zone from the
   * visitor's IP, the clock from an external authority (lib/true-time.ts). It
   * has to be one call, because a correct zone applied to a wrong clock still
   * lands on the wrong date, and then the whole page is a different day's
   * fixtures.
   */
  const { today } = await resolveRequestTime();

  let payload: MatchesPayload;
  try {
    const { matches, meta, nowUnix } = await getMatchesByDate(today, today);
    payload = { date: today, matches, meta, nowUnix };
  } catch (error) {
    if (classifyFailure(error) === "quota") return <QuotaNotice />;
    // The detail goes to the server log; the page gets a sanitised message.
    logFailure("home/matches", error);
    return <LoadErrorNotice error={error} />;
  }

  return (
    <>
      <MatchesView initialPayload={payload} />
      <HomeIntro matchCount={payload.matches.length} date={payload.date} />
      <HomeJsonLd />
    </>
  );
}

/**
 * Static, server-rendered description of what this page is.
 *
 * Two jobs, both search-related:
 *
 *  1. It gives Google snippet material that is real prose about football, so a
 *     result never has to be assembled out of UI labels and status lines. The
 *     fixture list itself is a client component whose text is dates, counts and
 *     team names — usable, but it reads as furniture, which is how a result for
 *     the homepage ended up looking like "الكل276 الأهم23. مباشر (43)".
 *  2. It states the brand's spellings (jdwal / jdwel / jadwal / جدول) in ordinary
 *     sentences and links out to the other sections, so both the brand terms and
 *     the internal link graph exist in the HTML rather than only in metadata.
 *     Google ignores the keywords meta tag entirely; body copy and links are
 *     what it actually reads.
 *
 * Last in the DOM so it never pushes the fixtures down.
 */
function HomeIntro({ matchCount, date }: { matchCount: number; date: string }) {
  return (
    <section className="border-t border-border px-3 py-6 sm:px-4">
      <h2 className="text-sm font-bold text-foreground">{t.seoHeading}</h2>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {t.seoIntro(matchCount, date)}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{t.seoBrands}</p>
      <nav aria-label={t.seoLinksLabel} className="mt-3 flex flex-wrap gap-2">
        <SeoLink href="/leagues">{t.seoLinkLeagues}</SeoLink>
        <SeoLink href="/scorers">{t.seoLinkScorers}</SeoLink>
        <SeoLink href="/players">{t.seoLinkPlayers}</SeoLink>
      </nav>
    </section>
  );
}

/**
 * `NavLink`, not `next/link` — every navigation in this app is a real document
 * load, for the reasons documented in components/nav-link.tsx. It also keeps
 * these links countable: a document load fires GA4's automatic `page_view`,
 * where a client-side transition would not.
 */
function SeoLink({ href, children }: { href: string; children: string }) {
  return (
    <NavLink
      href={href}
      className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      {children}
    </NavLink>
  );
}

/**
 * `WebPage` + `SiteNavigationElement` for the homepage specifically.
 *
 * The root layout already declares the `WebSite` entity; this adds what is true
 * of this page only — that it is the fixture list, refreshed daily, and where
 * its sibling sections are. Deliberately NOT a list of `SportsEvent` items: the
 * individual match pages are noindex by design (see app/match/[id]/page.tsx), so
 * emitting event markup that points at them would ask Google to surface URLs the
 * site has asked it not to index.
 */
function HomeJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}/#webpage`,
    url: SITE_URL,
    name: "جدول مباريات اليوم - jdwal",
    description: t.seoMetaDescription,
    inLanguage: "ar",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: {
      "@type": "Thing",
      name: "كرة القدم",
    },
    hasPart: [
      {
        "@type": "SiteNavigationElement",
        name: t.navLeagues,
        url: `${SITE_URL}/leagues`,
      },
      {
        "@type": "SiteNavigationElement",
        name: t.navScorers,
        url: `${SITE_URL}/scorers`,
      },
      {
        "@type": "SiteNavigationElement",
        name: t.playersTitle,
        url: `${SITE_URL}/players`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
