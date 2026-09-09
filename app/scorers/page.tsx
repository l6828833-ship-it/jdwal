import { NavLink } from "@/components/nav-link";
import { Suspense } from "react";
import { Crest } from "@/components/crest";
import { ScorersTable } from "@/components/scorers-table";
import { TableSkeleton } from "@/components/skeleton";
import { ApiKeyNotice, LoadErrorNotice, QuotaNotice } from "@/components/notices";
import { getLeagueScorers, getLeagues, hasApiKey } from "@/lib/provider";
import { POPULAR_LEAGUES } from "@/lib/config";
import { leagueNameAr } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { LeagueScorers, LeagueSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: t.topScorers,
  description:
    "ترتيب الهدافين وصناع الأهداف في الدوريات الكبرى ودوري أبطال أوروبا.",
};

/**
 * Top scorers, browsed by competition.
 *
 * The picker is the pinned popular leagues (a short, stable list), so the page
 * loads without first fetching the whole league catalogue. The chosen league's
 * leaderboard is then fetched on its own — a single request.
 */
export default async function ScorersPage(props: PageProps<"/scorers">) {
  if (!hasApiKey()) return <ApiKeyNotice />;

  const params = await props.searchParams;
  const rawLeague = Array.isArray(params.league) ? params.league[0] : params.league;

  // The tabs come from the active provider's own league ids so each link
  // resolves to a leaderboard that provider recognises.
  let leagues: LeagueSummary[] = [];
  try {
    ({ leagues } = await getLeagues());
  } catch {
    // Fall back to the pinned list if the catalogue call fails; the leaderboard
    // fetch below is what actually matters.
    leagues = [];
  }

  // Prefer the provider's popular leagues; else synthesize from POPULAR_LEAGUES.
  const tabs =
    leagues.filter((l) => l.isPopular).slice(0, 12).length > 0
      ? leagues.filter((l) => l.isPopular).slice(0, 12)
      : POPULAR_LEAGUES.map((p) => ({
          id: p.apiFootballId,
          name: p.ar,
          nameOriginal: p.aliases[0] ?? p.ar,
          country: null,
          countryCode: null,
          logo: null,
          seasonsAvailable: null,
          latestSeason: null,
          isPopular: true,
          popularityRank: 0,
        }));

  const requested = Number(rawLeague);
  const selected =
    tabs.find((l) => l.id === requested) ?? tabs[0] ?? null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="px-3 py-4 sm:px-4">
          <h1 className="text-base font-bold text-foreground">{t.topScorers}</h1>
          <p className="mt-0.5 text-xs text-muted">{t.scorersHint}</p>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-3 pb-3 no-scrollbar sm:px-4">
          {tabs.map((league) => {
            const active = league.id === selected?.id;
            return (
              <NavLink
                key={league.id}
                href={`/scorers?league=${league.id}`}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-accent text-white"
                    : "bg-surface text-muted hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                <Crest src={league.logo} name={league.name} size={16} />
                {leagueNameAr(league.id, league.nameOriginal)}
              </NavLink>
            );
          })}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
        {/**
         * The leaderboard streams on its own.
         *
         * The tab strip above needs only `getLeagues()`, which is effectively
         * instant, while the leaderboard is the expensive part — the backend
         * builds it by scanning a window of fixtures, measured at 13 seconds on a
         * cold cache. Awaiting both together meant the whole screen, tabs
         * included, waited on the slow one.
         *
         * Splitting them means the header and tabs paint straight away and stay
         * interactive: you can pick a different competition while one is still
         * loading, instead of watching a dead page. `key` re-arms the boundary on
         * each competition change, so switching tabs shows the skeleton again
         * rather than leaving the previous league's table up as if it were the
         * new one's.
         */}
        <Suspense key={selected?.id ?? "none"} fallback={<TableSkeleton rows={12} />}>
          <Leaderboard leagueId={selected?.id ?? null} />
        </Suspense>
      </main>
    </>
  );
}

/**
 * One competition's leaderboard.
 *
 * Errors are rendered in place rather than replacing the page, so a competition
 * the backend cannot answer for leaves the tabs usable to pick another.
 */
async function Leaderboard({ leagueId }: { leagueId: number | null }) {
  const empty: LeagueScorers = { available: false, seasonYear: null, scorers: [] };

  // Resolve first, render after: building JSX inside try/catch would let a
  // render-time throw from a child be swallowed by this handler instead of
  // reaching an error boundary.
  let scorers = empty;
  let failure: string | null = null;
  let quotaExhausted = false;

  if (leagueId != null) {
    try {
      ({ scorers } = await getLeagueScorers(leagueId));
    } catch (cause) {
      if (cause instanceof Error && /budget/i.test(cause.message)) {
        quotaExhausted = true;
      } else {
        failure = cause instanceof Error ? cause.message : String(cause);
      }
    }
  }

  if (quotaExhausted) return <QuotaNotice />;
  if (failure) return <LoadErrorNotice message={failure} />;
  return <ScorersTable data={scorers} />;
}
