import type { Metadata } from "next";
import { NavLink } from "@/components/nav-link";
import { BackHeader } from "@/components/back-header";
import { Crest } from "@/components/crest";
import { ApiKeyNotice, EmptyState, LoadErrorNotice, QuotaNotice } from "@/components/notices";
import { getMatchesByDate, hasApiKey } from "@/lib/provider";
import { resolveRequestTime } from "@/lib/geo-timezone";
import { classifyFailure, logFailure } from "@/lib/errors";
import { MATCH_INDEX_DAY_LIMIT } from "@/lib/config";
import { NOINDEX_FOLLOW, robotsFor } from "@/lib/seo";
import { groupByLeague } from "@/lib/grouping";
import { formatDateLong, formatKickoff, shiftDateKey } from "@/lib/date";
import { leagueNameAr, t } from "@/lib/i18n";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * `/match` — the match index.
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
 *   /match   a plain index — today AND tomorrow, server-rendered, no JavaScript
 *            required, kickoff times and links only.
 *
 * The second is worth its own URL because it covers a range the homepage cannot
 * show at once, and because it works as a crawl hub: it is the one page that
 * links to every match page, so a crawler can reach them (they are
 * `noindex,follow`, so following is exactly what they invite).
 */
const DESCRIPTION =
  "فهرس مباريات اليوم والغد بمواعيدها بتوقيتك المحلي — كل مباراة مع " +
  "مسابقتها ورابط تفاصيلها والنتيجة المباشرة.";

/**
 * Indexable only when it has fixtures — the shared policy in lib/seo.ts. Being
 * the section's one indexable URL makes that stricter here, not looser: if this
 * page is indexed while empty, the match section is represented in Google by a
 * page with nothing on it.
 *
 * The probe shares the page's own backend request through `getCached`, so asking
 * costs nothing.
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
    hasFixtures = (await getMatchesByDate(today, today)).matches.length > 0;
  } catch {
    hasFixtures = false;
  }

  return { ...base, robots: robotsFor(hasFixtures) };
}

/** One day's fixtures, or the reason there are none. */
interface DaySlice {
  dateKey: string;
  matches: Match[];
  /** Fixtures that day held before the cap, for the "showing N of M" line. */
  totalAvailable: number;
  failed: boolean;
}

/**
 * Cap a day's fixtures, keeping whole competitions.
 *
 * `groupByLeague` returns groups already ordered by competition popularity, so
 * taking groups from the front keeps the ones people search for. Truncating
 * mid-competition would leave a league showing three of its ten fixtures with
 * nothing saying why, so a group is taken whole or not at all — the first group
 * always is, so a single huge competition can never empty the page.
 */
function cappedGroups(matches: Match[], limit: number) {
  const groups = groupByLeague(matches);
  const kept: ReturnType<typeof groupByLeague> = [];
  let count = 0;

  for (const group of groups) {
    if (kept.length > 0 && count + group.matches.length > limit) break;
    kept.push(group);
    count += group.matches.length;
    if (count >= limit) break;
  }

  return { groups: kept, shown: count };
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

  const tomorrowMatches =
    tomorrowResult.status === "fulfilled" ? tomorrowResult.value.matches : [];

  const days: DaySlice[] = [
    {
      dateKey: today,
      matches: todayResult.value.matches,
      totalAvailable: todayResult.value.matches.length,
      failed: false,
    },
    {
      dateKey: tomorrow,
      matches: tomorrowMatches,
      totalAvailable: tomorrowMatches.length,
      failed: tomorrowResult.status === "rejected",
    },
  ];

  return (
    <>
      <BackHeader title={t.matchIndexTitle} />

      <main className="flex flex-1 flex-col gap-5 px-3 py-4 sm:px-4">
        <p className="text-xs leading-relaxed text-muted">
          {t.matchIndexIntro(
            days.reduce((sum, day) => sum + day.totalAvailable, 0),
          )}
        </p>

        {days.map((day) => (
          <DaySection key={day.dateKey} day={day} timezone={timezone} />
        ))}
      </main>
    </>
  );
}

function DaySection({ day, timezone }: { day: DaySlice; timezone: string }) {
  const { groups, shown } = cappedGroups(day.matches, MATCH_INDEX_DAY_LIMIT);
  const hidden = day.totalAvailable - shown;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold text-foreground">
        {formatDateLong(day.dateKey)}
      </h2>

      {groups.length === 0 ? (
        <EmptyState title={day.failed ? t.loadFailed : t.noMatches} />
      ) : (
        groups.map((group) => (
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

      {hidden > 0 && (
        <p className="px-1 text-center text-[0.7rem] text-muted">
          {t.matchIndexTruncated(shown, day.totalAvailable)}
        </p>
      )}
    </section>
  );
}
