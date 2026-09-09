import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest, Flag } from "@/components/crest";
import { BackHeader } from "@/components/back-header";
import { StandingsTable } from "@/components/standings-table";
import { LeagueMatches } from "@/components/league-matches";
import { KnockoutBracket } from "@/components/knockout-bracket";
import { LeagueTabs } from "@/components/league-tabs";
import { SeasonSelect } from "@/components/season-select";
import {
  ApiKeyNotice,
  PlanGatedNotice,
  QuotaNotice,
} from "@/components/notices";
import {
  getLeagueFixtures,
  getLeagueStandings,
  hasApiKey,
  isPlanGatedError,
  supportsHistoricalSeasons,
} from "@/lib/provider";
import { countryNameAr } from "@/lib/countries";
import { ensureTrueTime, nowDate, nowUnix as trueNowUnix } from "@/lib/true-time";
import { t } from "@/lib/i18n";
import type { Match } from "@/lib/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/**
 * Season the app queries by default (starting year: 2026 => 2026/2027).
 *
 * Reads the trusted clock, not `Date.now()` — a host whose year is wrong would
 * otherwise offer a season that returns an empty table for every competition.
 */
function defaultSeason(): number {
  const raw = Number(process.env.SELFHOSTED_SEASON);
  if (Number.isFinite(raw) && raw > 2000) return Math.round(raw);
  const now = nowDate();
  return now.getUTCMonth() + 1 >= 7
    ? now.getUTCFullYear()
    : now.getUTCFullYear() - 1;
}

/** The season options offered: the current one and a few years back. */
function seasonOptions(current: number): number[] {
  return [0, 1, 2, 3, 4].map((back) => current - back);
}

export async function generateMetadata(
  props: PageProps<"/league/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const leagueId = Number(id);
  if (!hasApiKey() || !Number.isInteger(leagueId)) return { title: t.appName };

  try {
    const result = await getLeagueStandings(leagueId);
    const name = result?.standings.league?.name;
    return { title: name ? `${name} — ${t.appName}` : t.appName };
  } catch {
    return { title: t.appName };
  }
}

export default async function LeaguePage(props: PageProps<"/league/[id]">) {
  if (!hasApiKey()) return <ApiKeyNotice />;

  const { id } = await props.params;
  const leagueId = Number(id);
  if (!Number.isInteger(leagueId) || leagueId <= 0) notFound();

  /**
   * Fallback "now" for when the fixtures call fails and carries no timestamp of
   * its own. Off the trusted clock, so a wrong host clock can't hand the client
   * an anchor hours out — see lib/true-time.ts. `ensureTrueTime` is awaited
   * first because this page does not otherwise resolve the request's time.
   */
  await ensureTrueTime();
  const nowUnixFallback = trueNowUnix();
  const params = await props.searchParams;
  const current = defaultSeason();
  const rawSeason = Array.isArray(params.season) ? params.season[0] : params.season;
  const season = Number(rawSeason);
  const selectedSeason =
    Number.isFinite(season) && season > 2000 ? season : current;

  // Standings and matches are independent; fetch in parallel. A failure in
  // either is handled without taking the page down. Whether the backend can
  // serve past seasons decides if the season picker is shown at all — a picker
  // that silently returns the current table is worse than no picker.
  const [standingsResult, fixturesResult, canPickSeason] = await Promise.all([
    getLeagueStandings(leagueId, selectedSeason).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason) => ({ status: "rejected" as const, reason }),
    ),
    getLeagueFixtures(leagueId).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason) => ({ status: "rejected" as const, reason }),
    ),
    supportsHistoricalSeasons().catch(() => false),
  ]);

  if (standingsResult.status === "rejected") {
    const error = standingsResult.reason;
    if (isPlanGatedError(error)) return <PlanGatedNotice />;
    if (error instanceof Error && /budget/i.test(error.message)) {
      return <QuotaNotice />;
    }
    // Standings can legitimately be empty for a cup with no table; only a real
    // throw lands here.
  }

  const result =
    standingsResult.status === "fulfilled" ? standingsResult.value : null;

  const fixtures =
    fixturesResult.status === "fulfilled"
      ? fixturesResult.value
      : {
          matches: [] as Match[],
          isCup: false,
          nowUnix: nowUnixFallback,
        };

  // Identify a cup either from the fixtures payload or a knockout-shaped table.
  const isCup =
    fixtures.isCup ||
    (result?.standings.source === "computed" &&
      /cup|champions|europa|conference|libertadores|world/i.test(
        result.standings.league?.nameOriginal ?? "",
      ));

  const league = result?.standings.league ?? null;
  const rows = result?.standings.rows ?? [];
  const seasonYear = result?.standings.seasonYear ?? selectedSeason;
  const title = league?.name ?? t.standings;

  const hasStandings = rows.length > 0;
  const hasMatches = fixtures.matches.length > 0;

  // A cup shows the bracket + matches; a league shows the table + matches.
  const standingsPanel = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent">
          {result?.standings.source === "computed"
            ? t.standingsLeaguePhase
            : t.standings}
        </span>
        {/* Only offer the season picker on a backend that actually serves past
            seasons. LiveScore / BBC / ESPN return the current table regardless
            of the season param, so the picker is hidden there rather than
            pretending to switch years. */}
        {canPickSeason && (
          <SeasonSelect
            leagueId={leagueId}
            seasons={seasonOptions(current)}
            selected={selectedSeason}
          />
        )}
      </div>

      {/* Guard: if a season param is forced via the URL on a current-only
          backend, still be honest that the table shown is the current one. */}
      {canPickSeason && selectedSeason !== current && (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-[0.7rem] leading-relaxed text-muted">
          {t.seasonScrapeNote}
        </p>
      )}

      {result?.standings.source === "computed" && rows.length > 0 && (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-[0.7rem] leading-relaxed text-muted">
          {t.standingsComputedNote}
          {rows.every((row) => (row.played ?? 0) === 0) ? (
            <span className="mt-1 block font-medium text-foreground">
              {t.standingsNotStarted}
            </span>
          ) : null}
        </p>
      )}

      <StandingsTable
        rows={rows}
        emptyMessage={
          result?.standings.source === "computed"
            ? t.standingsFixturesPending
            : undefined
        }
      />

      <Link
        href={`/scorers?league=${leagueId}`}
        className="self-start rounded-full bg-surface-raised px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
      >
        {t.topScorers}
      </Link>
    </div>
  );

  const matchesPanel = (
    <div className="flex flex-col gap-4">
      {isCup && <KnockoutBracket matches={fixtures.matches} />}
      {hasMatches ? (
        <LeagueMatches
          leagueId={leagueId}
          initialMatches={fixtures.matches}
          initialNowUnix={fixtures.nowUnix}
          isCup={isCup}
        />
      ) : (
        <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          {t.noMatches}
        </p>
      )}
    </div>
  );

  return (
    <>
      <BackHeader title={title} />

      <section className="flex items-center gap-3 border-b border-border bg-surface px-3 py-4 sm:px-4">
        <Crest src={league?.logo ?? null} name={title} size={40} />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-sm font-bold text-foreground">{title}</h1>
          <p className="flex items-center gap-1.5 text-[0.7rem] text-muted">
            <Flag code={league?.countryCode ?? null} />
            {countryNameAr(league?.country)}
            {seasonYear ? (
              <span className="tnum">· {formatSeason(seasonYear)}</span>
            ) : null}
            {isCup ? <span className="text-accent">· {t.knockoutBracket}</span> : null}
          </p>
        </div>
      </section>

      <main className="flex flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
        <LeagueTabs
          hasStandings={hasStandings}
          standings={standingsPanel}
          matches={matchesPanel}
        />
      </main>
    </>
  );
}

/** 20262027 -> "2026/2027", 2026 -> "2026". */
function formatSeason(year: number): string {
  const text = String(year);
  if (text.length === 8) return `${text.slice(0, 4)}/${text.slice(4)}`;
  return text;
}
