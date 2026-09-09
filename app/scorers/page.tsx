import Link from "next/link";
import { Crest } from "@/components/crest";
import { ScorersTable } from "@/components/scorers-table";
import { ApiKeyNotice, LoadErrorNotice, QuotaNotice } from "@/components/notices";
import { getLeagueScorers, getLeagues, hasApiKey } from "@/lib/provider";
import { POPULAR_LEAGUES } from "@/lib/config";
import { leagueNameAr } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { LeagueScorers, LeagueSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: `${t.topScorers} — ${t.appName}` };

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

  let scorers: LeagueScorers = { available: false, seasonYear: null, scorers: [] };
  let error: string | null = null;
  if (selected) {
    try {
      ({ scorers } = await getLeagueScorers(selected.id));
    } catch (cause) {
      if (cause instanceof Error && /budget/i.test(cause.message)) {
        return <QuotaNotice />;
      }
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  if (error) return <LoadErrorNotice message={error} />;

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
              <Link
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
              </Link>
            );
          })}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
        <ScorersTable data={scorers} />
      </main>
    </>
  );
}
