import { notFound } from "next/navigation";
import { MatchDetailView } from "@/components/match-detail-view";
import {
  ApiKeyNotice,
  LoadErrorNotice,
  PlanGatedNotice,
  QuotaNotice,
} from "@/components/notices";
import { getMatchDetail, hasApiKey, isPlanGatedError } from "@/lib/provider";
import { classifyFailure, logFailure } from "@/lib/errors";
import { NOINDEX_FOLLOW } from "@/lib/seo";
import { t } from "@/lib/i18n";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/match/[id]">,
): Promise<Metadata> {
  // A single match page is thin, near-duplicate and short-lived: ~300 new ones
  // a day, each ageing out of the data window into a "not found" notice within
  // days. Indexing them bloats the index with disposable URLs, spends crawl
  // budget on pages that soon 404, and dilutes the site's overall quality
  // signal — which drags down the pages that DO carry keyword value (home,
  // /leagues, /scorers). So every match page is noindex,follow: Google may
  // still crawl and follow the links (to discover live fixtures and internal
  // structure) but keeps the page out of the index. This also matches the
  // intent already documented in app/sitemap.ts, which omits match URLs.
  const noindex = NOINDEX_FOLLOW;
  /**
   * A URL with no match behind it renders the 404 page, so it must not claim a
   * canonical. Without `canonical: null` it inherited the root layout's `/`,
   * which told Google that every dead match URL was the homepage.
   */
  const gone: Metadata = {
    title: t.notFoundTitle,
    robots: noindex,
    alternates: { canonical: null },
  };

  const { id } = await props.params;
  const matchId = Number(id);
  if (!hasApiKey() || !Number.isInteger(matchId)) return gone;

  try {
    const result = await getMatchDetail(matchId);
    if (!result) return gone;
    const { home, away, league } = result.match;
    return {
      title: `${home.name} ${t.vs} ${away.name} — ${league.name}`,
      description: `${home.name} ${t.vs} ${away.name} في ${league.name} — النتيجة المباشرة والأهداف وتفاصيل المباراة.`,
      alternates: { canonical: `/match/${matchId}` },
      robots: noindex,
    };
  } catch {
    // A failure is not a missing match: keep the generic title and stay
    // noindex, but do not assert a canonical we cannot verify.
    return { title: t.appName, robots: noindex, alternates: { canonical: null } };
  }
}

export default async function MatchPage(props: PageProps<"/match/[id]">) {
  if (!hasApiKey()) return <ApiKeyNotice />;

  const { id } = await props.params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) notFound();

  let result: Awaited<ReturnType<typeof getMatchDetail>>;
  try {
    result = await getMatchDetail(matchId);
  } catch (error) {
    if (isPlanGatedError(error)) return <PlanGatedNotice />;
    if (classifyFailure(error) === "quota") return <QuotaNotice />;
    logFailure(`match/${matchId}`, error);
    return <LoadErrorNotice error={error} />;
  }

  /**
   * A missing match renders the shared 404 page.
   *
   * This replaces a bespoke "match not available" notice. The original reason for
   * that notice — not wanting to show a bare 404 — is satisfied now that
   * app/not-found.tsx is a proper Arabic page with links back, and using it means
   * one dead-end experience instead of two.
   *
   * The RESPONSE STATUS stays 200, and no amount of moving this call changes
   * that: the root layout resolves the request's timezone and clock over the
   * network, so every route streams and the status is committed before this code
   * runs. Raising it from `generateMetadata` instead was measured — still 200, as
   * was removing the segment's `loading.tsx`. So the technically-correct 404 is
   * out of reach here without restructuring the layout, and what keeps these URLs
   * out of Google is the `noindex` above, which is authoritative regardless of
   * status. A real 404 would need this check to move to middleware, which would
   * mean an upstream lookup on every match request.
   */
  if (!result) notFound();

  return (
    <MatchDetailView initialMatch={result.match} initialNowUnix={result.nowUnix} />
  );
}


