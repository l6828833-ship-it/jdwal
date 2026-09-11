import type { Metadata } from "next";
import { NavLink } from "@/components/nav-link";
import { Crest } from "@/components/crest";
import { ApiKeyNotice, EmptyState, LoadErrorNotice, QuotaNotice } from "@/components/notices";
import { getMatchesByDate, hasApiKey } from "@/lib/provider";
import { resolveRequestTime } from "@/lib/geo-timezone";
import { classifyFailure, logFailure } from "@/lib/errors";
import { NOINDEX_FOLLOW, robotsFor } from "@/lib/seo";
import { groupByLeague, isPopularMatch, type LeagueGroup } from "@/lib/grouping";
import { formatDateLong, formatKickoff, shiftDateKey } from "@/lib/date";
import { leagueNameAr, t } from "@/lib/i18n";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * `/match` — today's and tomorrow's fixtures in the major competitions.
 *
 * This URL used to 404. Every match page lives under `/match/<id>`, so `/match`
 * is the parent a visitor edits the address bar down to and the parent a crawler
 * infers from any match link — and it answered "This page could not be found."
 *
 * It is also the right page to be the indexable one. The individual match pages
 * are `noindex` on purpose (~300 new URLs a day, each disposable within days —
 * see app/match/[id]/page.tsx), which left the whole match section of the site
 * with no indexable entry point at all. This is that entry point.
 *
 * It is NOT a second copy of the homepage, which would just compete with it:
 *
 *   /        the live-score app — one day at a time, a date selector, filters,
 *            search, and polling that keeps scores moving.
 *   /match   a plain list — today AND tomorrow, server-rendered, no JavaScript
 *            required, kickoff times and links only.
 *
 * ── Why only the major competitions ─────────────────────────────────────────
 *
 * The first version listed everything the backend returned. A day of worldwide
 * football is ~550 fixtures, so after the competitions people came for it filled
 * with Welsh, Lithuanian and Serbian second divisions, U21 sides and reserve
 * teams — a dozen separate blocks all labelled "الدرجة الاولى", and one whose
 * name arrived as the bare fragment "ال". As a page that is noise; as the
 * section's one indexable URL it is worse, because that is what represents the
 * match section in Google.
 *
 * So the list is the pinned POPULAR_LEAGUES — the same editorial set behind the
 * homepage's "الأهم" filter, maintained in one place in lib/config.ts. Everything
 * else stays reachable through the homepage and the league pages, which the copy
 * says and links to.
 */
const DESCRIPTION =
  "مباريات اليوم والغد في أبرز الدوريات والبطولات بمواعيدها بتوقيتك المحلي — " +
  "النتيجة المباشرة والأهداف وتفاصيل كل مباراة.";

/**
 * Indexable only when it has fixtures — the shared policy in lib/seo.ts. Being
 * the section's one indexable URL makes that stricter here, not looser: if this
 * page is indexed while empty, the match section is represented in Google by a
 * page with nothing on it.
 *
 * The probe counts POPULAR fixtures, because those are what the page renders —
 * a day with 400 minor-league games and no major ones has nothing to show. It
 * shares the page's own backend request through `getCached`, so asking is free.
 */
export async function generateMetadata(): Promise<Metadata> {
  const base: Metadata = {
    title: t.matchIndexTitle,
    description: DESCRIPTION,
    alternates: { canonical: "/match" },
  };

  if (!hasApiKey()) return { ...base, robots: NOINDEX_FOLLOW };

  const { today } = await resolveRequestTime();
  let hasFixtures = false;
  try {
    const { matches } = await getMatchesByDate(today, today);
    hasFixtures = matches.some(isPopularMatch);
  } catch {
    hasFixtures = false;
  }

  return { ...base, robots: robotsFor(hasFixtures) };
}

/** One day, already reduced to what will be rendered. */
interface DaySlice {
  dateKey: string;
  groups: LeagueGroup[];
  /** Matches in `groups` — the only figure the copy is allowed to quote. */
  shown: number;
  failed: boolean;
}

function prepareDay(
  dateKey: string,
  matches: Match[],
  failed: boolean,
): DaySlice {
  const groups = groupByLeague(matches.filter(isPopularMatch));
  return {
    dateKey,
    groups,
    shown: groups.reduce((sum, group) => sum + group.matches.length, 0),
    failed,
  };
}

export default async function MatchIndexPage() {
  if (!hasApiKey()) return <ApiKeyNotice />;

  const { today, timezone } = await resolveRequestTime();
  const tomorrow = shiftDateKey(today, 1);

  /**
   * Both days at once.
   *
   * Independent lookups, so they overlap rather than queue — the whole render
   * shares one serverless wall-clock budget, and two sequential backend calls
   * put twice the per-call timeout on the critical path. Tomorrow failing is not
   * fatal; today failing is, because then the page has nothing to show.
   */
  const [todayResult, tomorrowResult] = await Promise.allSettled([
    getMatchesByDate(today, today),
    getMatchesByDate(tomorrow, today),
  ]);

  if (todayResult.status === "rejected") {
    const cause = todayResult.reason;
    if (classifyFailure(cause) === "quota") return <QuotaNotice />;
    logFailure("match-index", cause);
    return <LoadErrorNotice error={cause} />;
  }

  if (tomorrowResult.status === "rejected") {
    logFailure("match-index/tomorrow", tomorrowResult.reason);
  }

  const days = [
    prepareDay(today, todayResult.value.matches, false),
    prepareDay(
      tomorrow,
      tomorrowResult.status === "fulfilled" ? tomorrowResult.value.matches : [],
      tomorrowResult.status === "rejected",
    ),
  ];

  // Counted from the prepared days, so the sentence can never disagree with the
  // list underneath it.
  const shownTotal = days.reduce((sum, day) => sum + day.shown, 0);

  return (
    <>
      {/**
       * The same static header /leagues and /scorers use, rather than the
       * `BackHeader` this page started with. Two reasons: `BackHeader`'s title is
       * an `<h2>`, which left an indexable page with no `<h1>` at all; and it is a
       * client component with a `router.back()` button, which contradicts this
       * page's whole point of needing no JavaScript. A top-level section reached
       * from the sitemap has nothing to go "back" to anyway.
       */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-3 py-4 backdrop-blur-md sm:px-4">
        <h1 className="text-base font-bold text-foreground">
          {t.matchIndexTitle}
        </h1>
        <p className="mt-0.5 text-xs text-muted">{t.matchIndexSubtitle}</p>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-3 py-4 sm:px-4">
        <p className="text-xs leading-relaxed text-muted">
          {t.matchIndexIntro(shownTotal)}
        </p>

        {days.map((day) => (
          <DaySection key={day.dateKey} day={day} timezone={timezone} />
        ))}

        {/* The competitions this page leaves out are one link away. */}
        <p className="text-xs leading-relaxed text-muted">
          {t.matchIndexAllHint}{" "}
          <NavLink href="/" className="font-semibold text-accent hover:underline">
            {t.matchIndexAllLink}
          </NavLink>
        </p>
      </main>
    </>
  );
}

function DaySection({ day, timezone }: { day: DaySlice; timezone: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold text-foreground">
        {formatDateLong(day.dateKey)}
      </h2>

      {day.groups.length === 0 ? (
        <EmptyState title={day.failed ? t.loadFailed : t.noMatchesTop} />
      ) : (
        day.groups.map((group) => (
          <div
            key={group.league.id}
            className="overflow-hidden rounded-xl border border-border bg-surface"
          >
            <NavLink
              href={`/league/${group.league.id}`}
              className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold text-muted transition-colors hover:text-foreground"
            >
              <Crest src={group.league.logo} name={group.league.name} size={16} />
              {leagueNameAr(group.league.id, group.league.nameOriginal)}
            </NavLink>

            <ul>
              {group.matches.map((match) => (
                <li key={match.id} className="border-b border-border last:border-b-0">
                  {/**
                   * A plain link per match, with both team names in the anchor
                   * text. That text is the only thing describing the match page
                   * to a crawler that will not index it, and it is what a
                   * no-JavaScript reader sees.
                   */}
                  <NavLink
                    href={`/match/${match.id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-hover"
                  >
                    <span className="truncate">
                      {match.home.name} {t.vs} {match.away.name}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-muted">
                      {match.score.confirmed
                        ? `${match.score.home ?? "-"} - ${match.score.away ?? "-"}`
                        : formatKickoff(match.kickoffUnix, timezone)}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
