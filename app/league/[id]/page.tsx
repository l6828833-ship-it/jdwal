import { NavLink } from "@/components/nav-link";
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
import { isPinnedLeague, leagueHref, leagueIdFromSlug } from "@/lib/config";
import { NOINDEX_FOLLOW, robotsFor } from "@/lib/seo";
import { ensureTrueTime, nowDate, nowUnix as trueNowUnix } from "@/lib/true-time";
import { leagueNameAr, t } from "@/lib/i18n";
import type { LeagueRef, Match } from "@/lib/types";
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

/**
 * Only the CURATED competitions are indexable.
 *
 * The backend answers `/league/<id>` for every competition it tracks — roughly
 * 800, most of them behind a derived id in the 800000+ range — and with no
 * `robots` here every one of them inherited the layout's `index, follow`. The
 * result was 127 indexed league pages, nearly all third divisions, reserve teams
 * and youth sides that the data source names identically ("الدرجة الاولى", with
 * no country), against 20 that anyone searches for. That volume of thin,
 * near-duplicate pages is a site-wide quality signal, and it was competing for
 * crawl budget with the pages that carry real value.
 *
 * A page still needs its data to be indexed even when pinned, per the policy in
 * lib/seo.ts. Unpinned pages stay `follow`, so they remain reachable and their
 * links still count — they simply do not enter the index.
 */
/**
 * The `[id]` segment is a slug for curated competitions and a number for the
 * rest, so it is resolved before anything else uses it.
 *
 * Both forms are accepted by the route even though only one is ever linked: the
 * numeric form redirects to the slug at the edge (next.config.ts), and this is
 * what the slug then resolves against. Accepting both also means a bookmark or an
 * external link in either shape still reaches the page.
 */
function resolveLeagueId(param: string): number | null {
  const fromSlug = leagueIdFromSlug(param);
  if (fromSlug != null) return fromSlug;
  const numeric = Number(param);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

export async function generateMetadata(
  props: PageProps<"/league/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const leagueId = resolveLeagueId(id);
  if (!hasApiKey() || leagueId == null) {
    // An unresolvable segment renders the 404 page, so the title says so rather
    // than reading "جدول" — and it claims no canonical, since there is no page
    // here to be canonical for.
    return {
      title: t.notFoundTitle,
      robots: NOINDEX_FOLLOW,
      alternates: { canonical: null },
    };
  }

  const pinned = isPinnedLeague(leagueId);
  /**
   * A curated competition knows its own name without asking the backend.
   *
   * The standings call is the only source of a name here, and it comes back empty
   * for a competition that is between seasons or still in qualifying — so the
   * title fell back to the generic label "جدول الترتيب". The CAF Champions League
   * was titled that in September, which is both wrong and identical to every
   * other league page in the same state.
   */
  const pinnedName = pinned ? leagueNameAr(leagueId, "") : null;

  try {
    const result = await getLeagueStandings(leagueId);
    const name = result?.standings.league?.name || pinnedName;
    return {
      title: name ?? t.standings,
      description: name
        ? `${name} — جدول المباريات والترتيب والهدافين، ونتائج مباشرة.`
        : undefined,
      // The slug form, always — the numeric URL redirects here, so declaring it
      // as canonical would point at a redirect.
      alternates: { canonical: leagueHref(leagueId) },
      // Indexable on the NAME being known, not on the table existing: a cup in
      // its qualifying rounds is a real page with real fixtures, and it should
      // not drop out of the index for the months before its group stage.
      robots: pinned ? robotsFor(Boolean(name)) : NOINDEX_FOLLOW,
    };
  } catch {
    return {
      title: pinnedName ?? t.standings,
      robots: pinned ? robotsFor(Boolean(pinnedName)) : NOINDEX_FOLLOW,
    };
  }
}

export default async function LeaguePage(props: PageProps<"/league/[id]">) {
  if (!hasApiKey()) return <ApiKeyNotice />;

  const { id } = await props.params;
  const leagueId = resolveLeagueId(id);
  if (leagueId == null) notFound();

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

  /**
   * Who this page is about, in order of how well each source knows.
   *
   * The standings payload was the only source, and when it is empty — a cup
   * between seasons, or one still in its qualifying rounds — `league` was null and
   * everything downstream fell back to the generic label "جدول الترتيب". That is
   * how /league/12 rendered in September: titled "جدول الترتيب", with a crest
   * showing the initials "جد" because `Crest` derives initials from the name it is
   * given, and no country or flag. The page had real CAF fixtures on it the whole
   * time and still could not say which competition it was — which is also why the
   * name here did not match the one /leagues links to.
   *
   * The fixtures payload carries the same `LeagueRef` (id, Arabic name, crest,
   * country), so it answers whenever there are fixtures. Failing that, a pinned
   * competition's name is a local constant and needs no backend at all.
   */
  const fixturesLeague = fixtures.matches[0]?.league ?? null;
  const pinnedName = isPinnedLeague(leagueId) ? leagueNameAr(leagueId, "") : null;

  const resolved: LeagueRef | null =
    result?.standings.league ??
    fixturesLeague ??
    (pinnedName
      ? {
          id: leagueId,
          name: pinnedName,
          nameOriginal: pinnedName,
          country: null,
          countryCode: null,
          logo: null,
        }
      : null);

  /**
   * A curated competition uses its EDITORIAL name, whatever the payload says.
   *
   * The source appends the current phase to a competition's display name, and on
   * some it stacks several: the FA Cup arrived as "كأس الاتحاد الإنجليزي -
   * الجولات التمهيدية - دور التصفيات الأول - أبطال أوروبا". That is unusable as a
   * heading, and it disagreed with the `<title>`, which already preferred the
   * pinned name. Only the NAME is overridden — the crest and country still come
   * from whichever payload supplied them.
   */
  const league: LeagueRef | null =
    resolved && pinnedName ? { ...resolved, name: pinnedName } : resolved;

  const rows = result?.standings.rows ?? [];
  const seasonYear = result?.standings.seasonYear ?? selectedSeason;
  const title = league?.name ?? t.standings;

  const hasStandings = rows.length > 0;
  const hasMatches = fixtures.matches.length > 0;

  // A cup shows the bracket + matches; a league shows the table + matches.
  const standingsPanel = (
    <div className="flex flex-col gap-3">
      {/* `flex-wrap` because a long phase label plus the scorers link plus the
          season picker can exceed a narrow screen; wrapping is preferable to
          either squashing the pills or scrolling them out of reach. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent">
            {result?.standings.source === "computed"
              ? t.standingsLeaguePhase
              : t.standings}
          </span>

          {/* The scorers link sits beside the table's own label because the two
              are the same kind of thing — the league's rankings — so they belong
              together as a pair to choose between. Below the table it was easy
              to miss entirely on a full 18-team league, where it fell past the
              fold.

              Styled as a distinctly tappable pill with a chevron: adjacent to a
              plain label, a link needs to look like it goes somewhere, or it
              reads as a second inert badge. */}
          <NavLink
            href={`/scorers?league=${leagueId}`}
            className="flex items-center gap-1 rounded-full bg-surface-raised px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            {t.topScorers}
            {/* Points left: the "forward" direction in RTL. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3"
              aria-hidden="true"
            >
              <path d="m15 6-6 6 6 6" />
            </svg>
          </NavLink>
        </div>

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
