import type { Metadata } from "next";
import { MatchesView } from "@/components/matches-view";
import { NavLink } from "@/components/nav-link";
import { getMatchesByDate, hasApiKey } from "@/lib/provider";
import { resolveRequestTime } from "@/lib/geo-timezone";
import { ApiKeyNotice, LoadErrorNotice, QuotaNotice } from "@/components/notices";
import { SITE_URL } from "@/lib/config";
import { classifyFailure, logFailure } from "@/lib/errors";
import { isCarriedMatch } from "@/lib/grouping";
import { t } from "@/lib/i18n";
import type { MatchesPayload } from "@/lib/types";

/**
 * Rendered per request: the fixture list changes through the day and while
 * matches are in progress. Upstream traffic is still bounded by the shared
 * cache in lib/cache.ts, so dynamic rendering does not mean a request per view.
 */
export const dynamic = "force-dynamic";

/**
 * Homepage metadata is intentionally static and always indexable.
 *
 * A transient sports-feed outage must never emit `noindex` for the site's most
 * valuable URL: Google can revisit during the outage and remove the homepage
 * from results. The page has permanent, server-rendered explanatory copy even
 * when fixtures are unavailable, so it remains useful and indexable. Keeping
 * this metadata independent of the feed also saves an API/cache lookup.
 */
export function generateMetadata(): Metadata {
  return {
    title: { absolute: t.seoTitle },
    description: t.seoMetaDescription,
    alternates: { canonical: "/" },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}

export default async function HomePage() {
  if (!hasApiKey()) {
    return (
      <>
        <ApiKeyNotice />
        <HomeIntro matchCount={0} date="" />
        <HomeJsonLd />
      </>
    );
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
  const { today, timezone } = await resolveRequestTime();

  let payload: MatchesPayload;
  try {
    // `timezone` decides where the day starts: without it the list is a UTC day,
    // which for a reader in Riyadh drops the small hours of their own morning and
    // shows tomorrow's instead. See lib/selfhosted.ts.
    const { matches, meta, nowUnix } = await getMatchesByDate(
      today,
      today,
      false,
      timezone,
    );
    payload = {
      date: today,
      // Filtered here so a competition the site does not carry never reaches the
      // browser at all — it is neither rendered nor shipped in the payload.
      matches: matches.filter(isCarriedMatch),
      meta,
      nowUnix,
    };
  } catch (error) {
    const notice =
      classifyFailure(error) === "quota" ? (
        <QuotaNotice />
      ) : (
        <LoadErrorNotice error={error} />
      );

    if (classifyFailure(error) !== "quota") {
      // The detail goes to the server log; the page gets a sanitised message.
      logFailure("home/matches", error);
    }

    // Keep permanent SEO copy and WebPage schema in the document even while
    // the live feed is unavailable. A temporary API outage must not turn the
    // homepage into a thin error-only document for visitors or crawlers.
    return (
      <>
        {notice}
        <HomeIntro matchCount={0} date={today} />
        <HomeJsonLd />
      </>
    );
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
        <SeoLink href="/guides/following-live-matches">
          دليل المباريات المباشرة
        </SeoLink>
        <SeoLink href="/guides/reading-standings">
          شرح جدول الترتيب
        </SeoLink>
        <SeoLink href="/about">من نحن</SeoLink>
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
    name: t.seoTitle,
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
      {
        "@type": "SiteNavigationElement",
        name: "من نحن",
        url: `${SITE_URL}/about`,
      },
      {
        "@type": "SiteNavigationElement",
        name: "كيف يعمل جدول",
        url: `${SITE_URL}/how-it-works`,
      },
      {
        "@type": "SiteNavigationElement",
        name: "دليل متابعة المباريات المباشرة",
        url: `${SITE_URL}/guides/following-live-matches`,
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
