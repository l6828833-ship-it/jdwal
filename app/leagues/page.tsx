import Link from "next/link";
import { Crest, Flag } from "@/components/crest";
import { ApiKeyNotice, EmptyState, LoadErrorNotice } from "@/components/notices";
import { getLeagues, hasApiKey } from "@/lib/provider";
import { LEAGUE_LIST_LIMIT, POPULAR_LEAGUES } from "@/lib/config";
import { countryCode, countryNameAr } from "@/lib/countries";
import { leagueNameAr, t } from "@/lib/i18n";
import type { LeagueSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

// Plain page name; the root layout's title.template appends "جدول مباريات - jdwal".
export const metadata = {
  title: t.leaguesTitle,
  description:
    "كل الدوريات والبطولات — دوري أبطال أوروبا، الدوريات الأوروبية الكبرى، " +
    "الدوريات العربية وكأس العالم — مع جداول المباريات والترتيب.",
};

/**
 * Build the full display list by:
 *   1. Taking the pinned POPULAR_LEAGUES (always present — World Cup and Arab
 *      leagues appear here even when they have no fixtures today).
 *   2. Merging in today's live competitions, ranked after the pinned ones.
 *
 * The result is sorted by popularityRank (the array index in POPULAR_LEAGUES),
 * then alphabetically, so the ordering is always: European cups/leagues → Arab
 * → everything else.
 */
function buildLeagueList(fromProvider: LeagueSummary[]): LeagueSummary[] {
  // Seed with every pinned league, whether or not it appears in today's feed.
  const map = new Map<number, LeagueSummary>();
  POPULAR_LEAGUES.forEach((p, rank) => {
    map.set(p.apiFootballId, {
      id: p.apiFootballId,
      name: p.ar,
      nameOriginal: p.aliases[0] ?? p.ar,
      country: null,
      countryCode: null,
      logo: null,
      seasonsAvailable: null,
      latestSeason: null,
      isPopular: true,
      popularityRank: rank,
    });
  });

  // Overlay provider data so live logo/country info enriches the pinned entries.
  for (const league of fromProvider) {
    const existing = map.get(league.id);
    if (existing) {
      // Merge: keep the pinned Arabic name but adopt the live logo/country.
      map.set(league.id, {
        ...existing,
        logo: league.logo ?? existing.logo,
        country: league.country ?? existing.country,
        countryCode:
          league.countryCode ??
          countryCode(league.country) ??
          existing.countryCode,
      });
    } else {
      // An unpinned competition playing today — add it below the pinned block.
      map.set(league.id, league);
    }
  }

  const all = [...map.values()];
  all.sort((a, b) => {
    if (a.popularityRank !== b.popularityRank)
      return a.popularityRank - b.popularityRank;
    return a.name.localeCompare(b.name, "ar");
  });
  return all;
}

export default async function LeaguesPage() {
  if (!hasApiKey()) return <ApiKeyNotice />;

  let fromProvider: LeagueSummary[] = [];
  try {
    ({ leagues: fromProvider } = await getLeagues());
  } catch (error) {
    return (
      <LoadErrorNotice
        message={error instanceof Error ? error.message : String(error)}
      />
    );
  }

  const allLeagues = buildLeagueList(fromProvider);
  const leagues = allLeagues.slice(0, LEAGUE_LIST_LIMIT);
  const hiddenCount = allLeagues.length - leagues.length;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-3 py-4 backdrop-blur-md sm:px-4">
        <h1 className="text-base font-bold text-foreground">{t.leaguesTitle}</h1>
        <p className="mt-0.5 text-xs text-muted">{t.leaguesAvailable}</p>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
        {leagues.length === 0 ? (
          <EmptyState title={t.noResults} />
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border bg-surface">
            {leagues.map((league) => (
              <li key={league.id} className="border-b border-divider last:border-b-0">
                <Link
                  href={`/league/${league.id}`}
                  className={`flex items-center gap-3 border-s-2 px-3 py-3 transition-colors hover:bg-surface-hover sm:px-4 ${
                    league.isPopular ? "border-s-accent" : "border-s-transparent"
                  }`}
                >
                  <Crest src={league.logo} name={league.name} size={28} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {leagueNameAr(league.id, league.nameOriginal)}
                    </span>
                    <span className="flex items-center gap-1.5 text-[0.7rem] text-muted">
                      <Flag code={league.countryCode} />
                      {countryNameAr(league.country)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {hiddenCount > 0 && (
          <p className="px-1 text-center text-[0.7rem] text-muted">
            {t.leaguesTruncated(leagues.length, allLeagues.length)}
          </p>
        )}
      </main>
    </>
  );
}
