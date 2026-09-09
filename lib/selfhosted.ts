/**
 * Self-hosted SportScore provider — the default backend.
 *
 * Talks to your own SportScore instance (the Express app in `SportScore-main`),
 * which proxies API-Football and caches upstream responses in memory and,
 * optionally, MongoDB. Select with `SPORTS_PROVIDER=selfhosted` and point
 * `SELFHOSTED_BASE_URL` at it.
 *
 * Why this replaced the three hosted APIs: each of those was missing something
 * the UI needed, and the gaps did not overlap, so the app ended up calling all
 * three at once with three incompatible sets of ids.
 *
 *   Footballdata.io  no referee, no match clock, no leaderboards, 5 leagues free
 *   Highlightly      no team country, no halftime score, no teams/roster, no
 *                    leaderboards, group names discarded, 100 req/DAY
 *   RapidAPI/FotMob  no stats, no venue, no standings, league names unresolvable
 *
 * API-Football covers the union, so this one module serves every capability
 * from one set of ids. Concretely, this provider is the first that can supply:
 *   • a REAL match clock (`status.elapsed`) instead of a guess from kickoff
 *   • halftime / fulltime / extra-time / penalty scores
 *   • referee and venue
 *   • goal events with own-goal and penalty distinction
 *   • standings that keep their group names, so cup phases stay separate
 *   • top-scorer leaderboards
 *   • team country on list rows, which is what the flags need
 *
 * Request cost. The backend caches, but its own upstream quota is finite (100
 * requests/day on API-Football's free tier), so the same discipline applies:
 *   • a day of fixtures                1 request
 *   • the live overlay                 1 request, shared by every reader
 *   • a match detail page              1 request  (`/fixtures?id=` returns
 *                                      events + statistics + lineups inline)
 *   • standings, leagues, teams, scorers, player search   1 request each
 * The backend's remaining allowance is read from its `/quota` route and fed to
 * the shared budget guard, so the guard now protects a real number rather than
 * an assumed one.
 */

import { CACHE_TTL } from "./config";
import {
  getCached,
  recordUpstreamUsage,
  resetBudget,
} from "./cache";
import { countryCode, isNonNationalRegion } from "./countries";
import { leagueNameAr, stageAr, teamNameAr } from "./i18n";
import { resolveBroadcast } from "./broadcast";
import { compareMatches } from "./grouping";
import { leaguePopularity } from "./config";
import { MAX_MATCH_WINDOW_MINUTES, statusLabelAr } from "./clock";
// Aliased because several functions below bind a local `nowUnix`; the trusted
// clock must never be shadowed by one of them.
import { nowDate, nowMs, nowUnix as trueNowUnix } from "./true-time";
import type {
  ApiMeta,
  LeagueRef,
  LeagueScorers,
  LeagueStandings,
  LeagueSummary,
  Match,
  MatchDetail,
  MatchGoal,
  MatchStats,
  MatchStatus,
  PlayerSearchResult,
  Score,
  StandingRow,
  StandingZone,
  StatPair,
  TeamPage,
  TeamRef,
  TeamSummary,
  TopScorer,
  Venue,
} from "./types";

const BASE_URL = (
  process.env.SELFHOSTED_BASE_URL || "http://localhost:4000"
).replace(/\/+$/, "");

/**
 * Season to query, as its STARTING year: 2026 means 2026/2027.
 *
 * Defaults to the season in progress, rolling over in July. Keep this in sync
 * with the backend's own `DEFAULT_SEASON`.
 *
 * Resolved lazily rather than as a module constant so the year comes off the
 * trusted clock (lib/true-time.ts). Module evaluation happens before any request
 * has been served, so at that point there is nothing synced to read and only the
 * host's own clock is available. The window where a skewed clock changes the
 * answer is one day a year, but a wrong season year returns an empty table for
 * every competition, so it is not worth guessing at.
 */
let seasonCache: number | null = null;

function currentSeason(): number {
  if (seasonCache != null) return seasonCache;

  const raw = Number(process.env.SELFHOSTED_SEASON);
  if (Number.isFinite(raw) && raw > 2000) {
    seasonCache = Math.round(raw);
    return seasonCache;
  }

  const now = nowDate();
  seasonCache =
    now.getUTCMonth() + 1 >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return seasonCache;
}

export class SelfHostedError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SelfHostedError";
    this.status = status;
  }
}

/**
 * The backend holds the API-Football key, not this app, so there is nothing to
 * check here. Returning true means a misconfigured backend surfaces its own
 * actionable message ("No API-Football key configured. Set `key` in .env")
 * instead of this app guessing which env var is missing.
 */
export function hasKey(): boolean {
  return true;
}

/** No plan gating: a self-hosted backend exposes whatever its key covers. */
export function isPlanGatedError(): boolean {
  return false;
}

/**
 * Whether the backend can serve standings for PAST seasons.
 *
 * Read from the backend's `/health` (`upstream.historicalSeasons`): the BBC
 * scrape and ESPN sources only carry the current season and ignore a season
 * param, so a season picker on those is misleading. Cached briefly and defaulted
 * to false, so a page that can't reach `/health` simply doesn't offer the picker
 * rather than offering a broken one.
 */
let historicalSeasonsCache: { value: boolean; at: number } | null = null;
const HEALTH_TTL_MS = 5 * 60 * 1000;

export async function supportsHistoricalSeasons(): Promise<boolean> {
  // Trusted clock, not the host's: this is a duration, and a system clock that
  // jumps mid-session makes the TTL either expire instantly or never.
  const now = nowMs();
  if (historicalSeasonsCache && now - historicalSeasonsCache.at < HEALTH_TTL_MS) {
    return historicalSeasonsCache.value;
  }
  let value = false;
  try {
    const response = await fetch(`${BASE_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (response.ok) {
      const body = (await response.json()) as {
        upstream?: { historicalSeasons?: boolean };
      };
      value = body.upstream?.historicalSeasons === true;
    }
  } catch {
    value = false;
  }
  historicalSeasonsCache = { value, at: now };
  return value;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

/**
 * A stale budget figure left behind by a previous provider would block requests
 * against a quota this backend does not share. Cleared once per process, after
 * which `/quota` supplies the real numbers.
 */
let budgetScoped = false;
function scopeBudget(): void {
  if (budgetScoped) return;
  budgetScoped = true;
  resetBudget();
}

let quotaCheckedAt = 0;
const QUOTA_REFRESH_MS = 60_000;

interface RawQuota {
  dailyLimit: number | null;
  dailyRemaining: number | null;
}

/**
 * Read the backend's remaining API-Football allowance and hand it to the shared
 * budget guard. Fire-and-forget: this is telemetry, and it must never delay or
 * fail a data request.
 */
function refreshQuota(): void {
  const now = nowMs();
  if (now - quotaCheckedAt < QUOTA_REFRESH_MS) return;
  quotaCheckedAt = now;

  void (async () => {
    try {
      const response = await fetch(`${BASE_URL}/quota`, {
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) return;
      const quota = (await response.json()) as RawQuota;
      if (
        typeof quota.dailyLimit === "number" &&
        typeof quota.dailyRemaining === "number"
      ) {
        recordUpstreamUsage(
          quota.dailyLimit - quota.dailyRemaining,
          quota.dailyLimit,
        );
      }
    } catch {
      // Backend down or quota unknown: the guard simply stays inert.
    }
  })();
}

async function apiFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  scopeBudget();

  const url = new URL(`${BASE_URL}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      // Caching is handled in lib/cache.ts so the backend's quota can be
      // accounted for precisely; Next's fetch cache must not double-layer.
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new SelfHostedError(
      `Cannot reach the SportScore backend at ${BASE_URL}. Is it running? ` +
        `(${error instanceof Error ? error.message : String(error)})`,
      503,
    );
  }

  if (!response.ok) {
    // The backend reports a missing key as 401 and an upstream API error as
    // 502, with a `detail` field explaining which. Surface that verbatim —
    // it is the difference between "no data today" and "your key is dead".
    const body = (await response.json().catch(() => null)) as
      | { error?: string; detail?: string }
      | null;
    const detail = body?.detail || body?.error || `HTTP ${response.status}`;
    throw new SelfHostedError(`SportScore backend: ${detail}`, response.status);
  }

  refreshQuota();
  return (await response.json()) as T;
}

/**
 * The backend answers HTTP 200 with `{ error: "Empty data after multiple
 * attempts" }` when the upstream had nothing to return. Real failures now throw
 * (401/502/503), so an `error` field on a 200 unambiguously means "no data" and
 * is treated as empty rather than as a fault.
 */
function isEmpty(body: unknown): boolean {
  return Boolean(
    body && typeof body === "object" && "error" in body && (body as { error?: unknown }).error,
  );
}

// ---------------------------------------------------------------------------
// Raw API-Football shapes (as reshaped by the SportScore backend)
// ---------------------------------------------------------------------------

interface RawTeamSide {
  id?: number;
  name?: string;
  logo?: string | null;
  winner?: boolean | null;
}

interface RawFixtureLeague {
  id?: number;
  name?: string;
  country?: string | null;
  logo?: string | null;
  flag?: string | null;
  season?: number;
  round?: string | null;
}

interface RawFixtureCore {
  id?: number;
  referee?: string | null;
  timezone?: string;
  date?: string;
  timestamp?: number;
  venue?: { id?: number | null; name?: string | null; city?: string | null };
  /**
   * Real broadcasters for THIS fixture, e.g. ["beIN Sport 1 HD"].
   *
   * Supplied by the self-hosted backend from 365scores' `tvNetworks`, and the
   * only genuine per-match channel data available — no mainstream football API
   * exposes broadcast info, which is why lib/broadcast.ts exists as a fallback.
   *
   * Present only on the single-fixture endpoint: the upstream games LIST carries
   * a bare `hasTVNetworks` flag with a null array, so channels cannot be shown on
   * the fixture list without one request per match.
   */
  tv_channels?: string[] | null;
  status?: { long?: string; short?: string; elapsed?: number | null };
}

interface RawGoals {
  home?: number | null;
  away?: number | null;
}

interface RawScore {
  halftime?: RawGoals;
  fulltime?: RawGoals;
  extratime?: RawGoals;
  penalty?: RawGoals;
}

interface RawEvent {
  time?: { elapsed?: number | null; extra?: number | null };
  team?: RawTeamSide;
  player?: { id?: number | null; name?: string | null };
  assist?: { id?: number | null; name?: string | null };
  type?: string;
  detail?: string;
}

interface RawStatEntry {
  team?: RawTeamSide;
  statistics?: Array<{ type?: string; value?: number | string | null }>;
}

interface RawFixture {
  fixture?: RawFixtureCore;
  league?: RawFixtureLeague;
  teams?: { home?: RawTeamSide; away?: RawTeamSide };
  goals?: RawGoals;
  score?: RawScore;
  /** Present only on the enriched single-fixture route. */
  events?: RawEvent[];
  statistics?: RawStatEntry[];
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * API-Football status codes. Trusted verbatim — no kickoff-time guessing — so a
 * scheduled match can never show a fabricated minute.
 *
 *   NS  not started      1H/2H  halves        HT  half time
 *   ET  extra time       BT     break         P   penalty shootout
 *   FT  full time        AET    after ET      PEN decided on penalties
 *   PST postponed        CANC   cancelled     ABD abandoned
 *   SUSP suspended       INT    interrupted   TBD kickoff undecided
 *   AWD awarded          WO     walkover      LIVE in play
 */
function mapStatus(short: string | undefined): MatchStatus {
  switch ((short ?? "").toUpperCase()) {
    case "NS":
    case "TBD":
      return "scheduled";
    case "1H":
    case "2H":
    case "HT":
    case "ET":
    case "BT":
    case "P":
    case "LIVE":
    case "INT":
    case "SUSP":
      return "live";
    case "FT":
    case "AET":
    case "PEN":
    case "AWD":
    case "WO":
      return "finished";
    case "PST":
      return "postponed";
    case "CANC":
    case "ABD":
      return "cancelled";
    default:
      return "unknown";
  }
}

/**
 * ISO country code for a league.
 *
 * Prefers our own country table, because it resolves the home nations
 * separately ("England" -> gb-eng) where API-Football's flag URL collapses them
 * all onto gb.svg. The flag URL is the fallback for countries the table has not
 * been taught yet.
 */
function leagueCountryCode(
  country: string | null | undefined,
  flag: string | null | undefined,
): string | null {
  const mapped = countryCode(country);
  if (mapped) return mapped;
  const match = /\/flags\/([a-z]{2})\.svg/i.exec(flag ?? "");
  return match ? match[1].toLowerCase() : null;
}

function normalizeLeague(raw: RawFixtureLeague | undefined): LeagueRef {
  const id = raw?.id ?? 0;
  const original = raw?.name?.trim() || `#${id}`;
  const country = raw?.country?.trim() || null;
  return {
    id,
    name: leagueNameAr(id, original),
    nameOriginal: original,
    country,
    countryCode: leagueCountryCode(country, raw?.flag),
    logo: raw?.logo ?? null,
  };
}

/**
 * Fixtures carry no team nationality, but they do carry the competition's
 * country — and for a domestic league that is both teams' country. Continental
 * and international competitions report a region ("World", "Europe") instead,
 * which is nobody's nationality, so those fall back to null rather than
 * flagging every Champions League side as European.
 */
function teamCountryFromLeague(country: string | null): string | null {
  if (!country) return null;
  return isNonNationalRegion(country) ? null : country;
}

function normalizeTeam(
  raw: RawTeamSide | undefined,
  leagueCountry: string | null,
): TeamRef {
  const original = raw?.name?.trim() || "—";
  const country = teamCountryFromLeague(leagueCountry);
  return {
    id: raw?.id ?? 0,
    name: teamNameAr(original),
    nameOriginal: original,
    logo: raw?.logo ?? null,
    country,
    countryCode: countryCode(country),
  };
}

function num(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeScore(raw: RawFixture, status: MatchStatus): Score {
  const confirmed = status === "live" || status === "finished";
  return {
    home: confirmed ? num(raw.goals?.home) : null,
    away: confirmed ? num(raw.goals?.away) : null,
    // A genuine halftime score, which none of the previous providers supplied.
    halftimeHome: confirmed ? num(raw.score?.halftime?.home) : null,
    halftimeAway: confirmed ? num(raw.score?.halftime?.away) : null,
    confirmed,
  };
}

function normalizeVenue(
  raw: RawFixtureCore | undefined,
  homeCountryCode: string | null,
): Venue | null {
  const name = raw?.venue?.name?.trim() || null;
  const city = raw?.venue?.city?.trim() || null;
  if (!name && !city) return null;
  return {
    name,
    location: city,
    countryCode: homeCountryCode,
    // API-Football exposes no attendance figure on any endpoint.
    attendance: null,
  };
}

/**
 * `referee` is a single free-text field, sometimes "Name, Country".
 * The country half is only treated as such when it resolves to a real country,
 * so a name containing a comma is not mistaken for one.
 */
function normalizeReferee(
  raw: string | null | undefined,
): { name: string; countryCode: string | null } | null {
  const text = raw?.trim();
  if (!text) return null;

  const comma = text.lastIndexOf(",");
  if (comma > 0) {
    const tail = text.slice(comma + 1).trim();
    const code = countryCode(tail);
    if (code) return { name: text.slice(0, comma).trim(), countryCode: code };
  }
  return { name: text, countryCode: null };
}

/** "Regular Season - 3" / "Group Stage - 1" -> 3 / 1. */
function parseGameWeek(round: string | null | undefined): number | null {
  if (!round) return null;
  const match = /(\d+)\s*$/.exec(round.trim());
  return match ? Number(match[1]) : null;
}

function normalizeMatch(raw: RawFixture): Match {
  const core = raw.fixture;
  const isHalfTime = (core?.status?.short ?? "").toUpperCase() === "HT";

  const kickoffUnix =
    num(core?.timestamp) ??
    (core?.date ? Math.floor(Date.parse(core.date) / 1000) : 0) ??
    0;

  /**
   * Stale-live guard.
   *
   * LiveScore's date feed sometimes freezes a finished match on its last live
   * minute (e.g. "90+7") instead of flipping it to FT, so the match sits at
   * "97'" with a running clock forever. No football match runs this long — past
   * MAX_MATCH_WINDOW_MINUTES after kickoff a match the source still calls "live"
   * has certainly ended — so it is treated as finished. The score is already
   * final in the feed, so this only corrects the status/minute, never a result.
   */
  const rawStatus = mapStatus(core?.status?.short);
  // Trusted clock: `kickoffUnix` is a real UTC instant from the provider, so
  // comparing it against a skewed host clock measures the skew, not elapsed
  // time — which would force every live match to "finished" (or hold a finished
  // one open) depending on which way the machine is wrong.
  const minutesSinceKickoff =
    kickoffUnix > 0 ? Math.floor((trueNowUnix() - kickoffUnix) / 60) : 0;
  const status: MatchStatus =
    rawStatus === "live" && minutesSinceKickoff > MAX_MATCH_WINDOW_MINUTES
      ? "finished"
      : rawStatus;

  /**
   * The real elapsed minute from the provider. This is the headline gain over
   * every previous backend, all of which had to estimate it from kickoff and so
   * got a late kickoff or any stoppage wrong.
   */
  const minute =
    status === "live" ? Math.min(num(core?.status?.elapsed) ?? 0, 130) || null : null;

  const league = normalizeLeague(raw.league);
  const home = normalizeTeam(raw.teams?.home, league.country);
  const away = normalizeTeam(raw.teams?.away, league.country);
  const gameWeek = parseGameWeek(raw.league?.round);

  return {
    id: core?.id ?? 0,
    kickoff: new Date(kickoffUnix * 1000).toISOString(),
    kickoffUnix,
    status,
    statusLabel: statusLabelAr(status, minute, isHalfTime),
    minute,
    isHalfTime,
    league,
    home,
    away,
    score: normalizeScore(raw, status),
    venue: normalizeVenue(core, home.countryCode),
    round: {
      // Prefer the localized label; fall back to the provider's English round
      // string for knockout ties, which carry no matchday number.
      stage: stageAr(gameWeek, league.nameOriginal) ?? raw.league?.round?.trim() ?? null,
      gameWeek,
      roundId: null,
    },
    referee: normalizeReferee(core?.referee),
    /**
     * Real channels from the backend when it has them, the editorial table
     * otherwise. Passing them in keeps the precedence in one place — see
     * `resolveBroadcast` — rather than deciding it at each call site.
     */
    broadcast: resolveBroadcast(core?.id ?? 0, league.id, league.nameOriginal, {
      channels: core?.tv_channels ?? null,
    }),
  };
}

/** Goals from the event feed, in chronological order. */
function extractGoals(raw: RawFixture): MatchGoal[] | undefined {
  if (!Array.isArray(raw.events)) return undefined;

  const homeId = raw.teams?.home?.id;

  return raw.events
    .filter((event) => {
      if ((event.type ?? "").toLowerCase() !== "goal") return false;
      // "Missed Penalty" is typed as a Goal event but is not one.
      return !(event.detail ?? "").toLowerCase().includes("missed");
    })
    .map((event) => {
      const detail = (event.detail ?? "").toLowerCase();
      const elapsed = num(event.time?.elapsed) ?? 0;
      const extra = num(event.time?.extra);
      return {
        minute: extra ? `${elapsed}+${extra}` : String(elapsed),
        // Shown as the provider spells it: no club-name translation is ever
        // applied to a person's name.
        player: event.player?.name?.trim() || "—",
        assist: event.assist?.name?.trim() || null,
        team: event.team?.id === homeId ? ("home" as const) : ("away" as const),
        kind: detail.includes("own")
          ? ("own" as const)
          : detail.includes("penalty")
            ? ("penalty" as const)
            : ("goal" as const),
      };
    });
}

/** "54%" -> 54, 12 -> 12, null -> null. */
function parseStatValue(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function extractStats(raw: RawFixture): MatchStats | null {
  const entries = raw.statistics;
  if (!Array.isArray(entries) || entries.length < 2) return null;

  const homeId = raw.teams?.home?.id;
  const homeEntry = entries.find((e) => e.team?.id === homeId) ?? entries[0];
  const awayEntry = entries.find((e) => e.team?.id !== homeId) ?? entries[1];

  const pick = (entry: RawStatEntry | undefined, type: string): number | null => {
    const hit = entry?.statistics?.find(
      (stat) => (stat.type ?? "").toLowerCase() === type.toLowerCase(),
    );
    return parseStatValue(hit?.value);
  };
  const pair = (type: string): StatPair => ({
    home: pick(homeEntry, type),
    away: pick(awayEntry, type),
  });

  const stats: MatchStats = {
    possession: pair("Ball Possession"),
    shotsTotal: pair("Total Shots"),
    shotsOnTarget: pair("Shots on Goal"),
    yellowCards: pair("Yellow Cards"),
    redCards: pair("Red Cards"),
    corners: pair("Corner Kicks"),
    fouls: pair("Fouls"),
    offsides: pair("Offsides"),
    hasAny: false,
  };

  stats.hasAny = [
    stats.possession,
    stats.shotsTotal,
    stats.shotsOnTarget,
    stats.yellowCards,
    stats.redCards,
    stats.corners,
    stats.fouls,
    stats.offsides,
  ].some((p) => p.home !== null || p.away !== null);

  return stats.hasAny ? stats : null;
}

function meta(
  fromCache: boolean,
  ageSeconds: number,
  budgetBlocked: boolean,
  error?: string,
): ApiMeta {
  return {
    plan: "selfhosted",
    requestsUsed: null,
    requestsLimit: null,
    fromCache,
    budgetBlocked,
    ageSeconds,
    error,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** The backend returns a bare array of fixtures, or `{ error }` when empty. */
function asFixtureList(body: unknown): RawFixture[] {
  if (Array.isArray(body)) return body as RawFixture[];
  // `/db/*` routes answer with the persisted wrapper instead of a bare array.
  if (body && typeof body === "object" && Array.isArray((body as { allFixtures?: unknown }).allFixtures)) {
    return (body as { allFixtures: RawFixture[] }).allFixtures;
  }
  return [];
}

/**
 * Live fixtures, keyed by id.
 *
 * One request covers every live match anywhere, and it is shared by the day
 * list and by every match detail page, so the freshest scores cost one request
 * per poll interval no matter how many readers there are.
 */
async function getLiveMap(): Promise<Map<number, RawFixture>> {
  try {
    const cached = await getCached(
      "sh-live",
      async () =>
        asFixtureList(
          await apiFetch<unknown>("/fixtures/getFixtures", { live: "all" }),
        ),
      { ttlSeconds: CACHE_TTL.live, priority: "high" },
    );
    return new Map(
      cached.value
        .filter((raw) => raw.fixture?.id)
        .map((raw) => [raw.fixture!.id as number, raw]),
    );
  } catch {
    // The overlay is an enhancement; a failure must not break the fixture list.
    return new Map();
  }
}

/** Overlay the live feed's status, clock and score onto a cached fixture. */
function mergeLive(base: RawFixture, live: RawFixture | undefined): RawFixture {
  if (!live) return base;
  return {
    ...base,
    fixture: { ...base.fixture, ...live.fixture },
    goals: live.goals ?? base.goals,
    score: live.score ?? base.score,
  };
}

/**
 * Whether a date can still hold an in-progress match.
 *
 * `dateKey === todayKeyValue` is not good enough, and getting this wrong froze
 * the live clock outright. Two independent reasons a date one day either side of
 * UTC today can be live:
 *
 *  • Timezones. "Today" is decided in the viewer's zone, so a viewer in Los
 *    Angeles asks for a date that is already yesterday in UTC. That date was
 *    then classed as settled history — cached for 24 HOURS with the live overlay
 *    skipped — so a match in progress showed a stopped clock and a stale score.
 *
 *  • Midnight straddle. A match kicking off at 22:00 UTC is still being played
 *    after 00:00 UTC, while belonging to the previous day.
 *
 * So freshness is decided by proximity to UTC now, never by string equality
 * against a timezone-dependent label.
 */
function canBeLive(dateKey: string): boolean {
  const noon = Date.parse(`${dateKey}T12:00:00Z`);
  if (!Number.isFinite(noon)) return false;
  // "UTC now" from the trusted clock. On a host whose date is wrong this test
  // classed today as settled history — 24-hour cache, live overlay skipped —
  // which is the same frozen clock the comment above describes.
  const todayNoon = Date.parse(
    `${nowDate().toISOString().slice(0, 10)}T12:00:00Z`,
  );
  return Math.abs(noon - todayNoon) <= 24 * 60 * 60 * 1000;
}

export async function getMatchesByDate(
  dateKey: string,
  todayKeyValue: string,
  background = false,
): Promise<{ matches: Match[]; meta: ApiMeta; nowUnix: number }> {
  const isToday = dateKey === todayKeyValue;
  const live = canBeLive(dateKey);

  const cached = await getCached(
    `sh-matches:${dateKey}`,
    async () =>
      asFixtureList(
        await apiFetch<unknown>("/fixtures/getFixtures", {
          date: dateKey,
          // Ask for UTC and convert for display ourselves, so one cache entry
          // serves every reader regardless of their timezone.
          timezone: "UTC",
        }),
      ),
    {
      // A date that can still be live never gets the 24-hour "past" lifetime,
      // whatever the viewer's calendar says.
      ttlSeconds: live
        ? CACHE_TTL.today
        : dateKey < todayKeyValue
          ? CACHE_TTL.past
          : CACHE_TTL.future,
      // A background poll must never outrank a user's own action for budget.
      priority: background ? "background" : isToday || live ? "high" : "normal",
    },
  );

  // The overlay is what keeps an in-progress score and minute fresh, so it runs
  // for any date that could hold a live match — not only the server's "today".
  const liveMap = live ? await getLiveMap() : new Map<number, RawFixture>();

  const matches = cached.value.map((raw) =>
    normalizeMatch(mergeLive(raw, liveMap.get(raw.fixture?.id ?? -1))),
  );
  matches.sort(compareMatches);

  return {
    matches,
    nowUnix: trueNowUnix(),
    meta: meta(
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

export async function getMatchDetail(
  matchId: number,
): Promise<{ match: MatchDetail; meta: ApiMeta; nowUnix: number } | null> {
  const cached = await getCached(
    `sh-match:${matchId}`,
    async () => {
      const body = await apiFetch<RawFixture>("/fixtures/getFixtureById", {
        id: matchId,
      });
      return isEmpty(body) ? null : body;
    },
    { ttlSeconds: CACHE_TTL.matchDetail, priority: "high" },
  );

  const raw = cached.value;
  if (!raw?.fixture?.id) return null;

  // Detail is cached for a couple of minutes; overlay the live feed so an
  // in-progress score is never staler than the poll interval.
  const liveMap = await getLiveMap();
  const merged = mergeLive(raw, liveMap.get(matchId));

  return {
    match: {
      ...normalizeMatch(merged),
      stats: extractStats(merged),
      goals: extractGoals(merged),
    },
    nowUnix: trueNowUnix(),
    meta: meta(
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

interface RawStandingRow {
  rank?: number;
  team?: RawTeamSide;
  points?: number | null;
  goalsDiff?: number | null;
  group?: string | null;
  form?: string | null;
  /** Qualification/relegation label, e.g. "UEFA Champions League". */
  description?: string | null;
  all?: {
    played?: number | null;
    win?: number | null;
    draw?: number | null;
    lose?: number | null;
    goals?: { for?: number | null; against?: number | null };
  };
}

/**
 * Map a provider's free-text zone label onto our colour-coded zone.
 *
 * The label is the human phrase the source uses ("UEFA Champions League",
 * "Relegation", "Promotion Play-off"), which differs in wording but not in
 * meaning across sources, so it is matched on keywords rather than exact
 * strings.
 */
function classifyZone(label: string | null | undefined): StandingZone {
  const s = (label ?? "").toLowerCase();
  if (!s) return null;
  if (s.includes("relegat")) return "relegation";
  if (s.includes("champions league") || s.includes("champions")) return "champions";
  if (s.includes("conference")) return "conference";
  if (s.includes("europa") || s.includes("uefa cup")) return "europa";
  if (s.includes("promot") && s.includes("play")) return "playoff";
  if (s.includes("promot")) return "promotion";
  if (s.includes("play-off") || s.includes("playoff") || s.includes("play off")) {
    return "playoff";
  }
  // A generic "qualification" phrase without a named competition is treated as
  // top qualification (green).
  if (s.includes("qualif")) return "champions";
  return null;
}

interface RawStandingsBody {
  league?: RawFixtureLeague;
  /** API-Football nests one table per group. */
  standings?: RawStandingRow[][];
  error?: string;
}

export async function getLeagueStandings(
  leagueId: number,
  season?: number,
): Promise<{
  standings: LeagueStandings;
  meta: ApiMeta;
} | null> {
  const seasonYear = season && Number.isFinite(season) ? season : currentSeason();
  const cached = await getCached(
    `sh-standings:${leagueId}:${seasonYear}`,
    async () => {
      const body = await apiFetch<RawStandingsBody>("/standings/getStandings", {
        league: leagueId,
        season: seasonYear,
      });
      return isEmpty(body) ? null : body;
    },
    { ttlSeconds: CACHE_TTL.standings, priority: "normal" },
  );

  const raw = cached.value;
  if (!raw) return null;

  const league = raw.league ? normalizeLeague(raw.league) : null;
  const leagueCountry = league?.country ?? null;

  /**
   * Flatten the per-group tables, keeping each row's group label.
   *
   * The label is what makes a cup table readable: without it the Champions
   * League league phase and its groups collapse into one ranking where position
   * 1 appears several times. Every previous provider discarded it.
   */
  const rows: StandingRow[] = [];
  for (const group of raw.standings ?? []) {
    for (const row of group ?? []) {
      rows.push({
        position: row.rank ?? 0,
        team: normalizeTeam(row.team, leagueCountry),
        group: row.group?.trim() || null,
        zoneLabel: row.description?.trim() || null,
        zone: classifyZone(row.description),
        played: num(row.all?.played),
        wins: num(row.all?.win),
        draws: num(row.all?.draw),
        losses: num(row.all?.lose),
        goalsFor: num(row.all?.goals?.for),
        goalsAgainst: num(row.all?.goals?.against),
        // Legitimately negative, so it must not go through a positive-only
        // sanitizer.
        goalDifference: row.goalsDiff ?? null,
        points: num(row.points),
      });
    }
  }

  return {
    standings: {
      league,
      seasonYear: raw.league?.season ?? seasonYear,
      rows,
      // API-Football's own table, which already accounts for point deductions
      // and keeps qualifying rounds in separate groups. No derivation needed.
      source: "provider",
    },
    meta: meta(
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

// ---------------------------------------------------------------------------
// League fixtures (recent + upcoming) for the league page
// ---------------------------------------------------------------------------

interface RawLeagueFixturesBody {
  league?: { type?: string };
  fixtures?: RawFixture[];
  error?: string;
}

/**
 * A competition's recent results and upcoming matches, plus whether it is a
 * league or a cup (which the page uses to decide between a table layout and a
 * knockout-bracket layout).
 */
export async function getLeagueFixtures(leagueId: number): Promise<{
  matches: Match[];
  isCup: boolean;
  meta: ApiMeta;
  nowUnix: number;
}> {
  const cached = await getCached(
    `sh-league-fixtures:${leagueId}`,
    async () => {
      const body = await apiFetch<RawLeagueFixturesBody>(
        "/fixtures/getLeagueFixtures",
        { league: leagueId },
      );
      if (isEmpty(body)) return { fixtures: [] as RawFixture[], isCup: false };
      return {
        fixtures: body.fixtures ?? [],
        isCup: (body.league?.type ?? "").toLowerCase() === "cup",
      };
    },
    { ttlSeconds: CACHE_TTL.today, priority: "normal" },
  );

  const nowUnix = trueNowUnix();
  const liveMap = await getLiveMap();
  const matches = cached.value.fixtures
    .map((raw) => normalizeMatch(mergeLive(raw, liveMap.get(raw.fixture?.id ?? -1))))
    .sort((a, b) => a.kickoffUnix - b.kickoffUnix);

  return {
    matches,
    isCup: cached.value.isCup,
    nowUnix,
    meta: meta(
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

// ---------------------------------------------------------------------------
// Leagues
// ---------------------------------------------------------------------------

interface RawLeagueListItem {
  league?: { id?: number; name?: string; type?: string; logo?: string | null };
  country?: { name?: string | null; code?: string | null; flag?: string | null };
  seasons?: Array<{ year?: number; current?: boolean }>;
}

export async function getLeagues(): Promise<{
  leagues: LeagueSummary[];
  meta: ApiMeta;
}> {
  const cached = await getCached(
    "sh-leagues",
    async () => {
      const body = await apiFetch<unknown>("/leagues/getLeagues", {
        current: "true",
      });
      if (Array.isArray(body)) return body as RawLeagueListItem[];
      const wrapped = (body as { allLeagues?: RawLeagueListItem[] })?.allLeagues;
      return Array.isArray(wrapped) ? wrapped : [];
    },
    { ttlSeconds: CACHE_TTL.leagues, priority: "normal" },
  );

  const leagues: LeagueSummary[] = cached.value
    .filter((item) => item.league?.id)
    .map((item) => {
      const id = item.league!.id as number;
      const original = item.league?.name?.trim() || `#${id}`;
      const country = item.country?.name?.trim() || null;
      const { rank } = leaguePopularity(id, original);
      const years = (item.seasons ?? [])
        .map((s) => s.year)
        .filter((y): y is number => typeof y === "number");

      return {
        id,
        name: leagueNameAr(id, original),
        nameOriginal: original,
        country,
        countryCode: leagueCountryCode(country, item.country?.flag),
        logo: item.league?.logo ?? null,
        seasonsAvailable: years.length || null,
        latestSeason: years.length ? Math.max(...years) : null,
        isPopular: Number.isFinite(rank),
        popularityRank: rank,
      };
    });

  leagues.sort((a, b) => {
    if (a.popularityRank !== b.popularityRank) {
      return a.popularityRank - b.popularityRank;
    }
    return a.name.localeCompare(b.name, "ar");
  });

  return {
    leagues,
    meta: meta(
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

interface RawTeamEntry {
  team?: {
    id?: number;
    name?: string;
    country?: string | null;
    founded?: number | null;
    logo?: string | null;
  };
  venue?: { name?: string | null; city?: string | null };
}

interface RawTeamsBody {
  allTeams?: RawTeamEntry[];
  error?: string;
}

function normalizeTeamSummary(
  entry: RawTeamEntry,
  leagueName: string | null,
): TeamSummary {
  const original = entry.team?.name?.trim() || "—";
  // Unlike fixtures, `/teams` carries a real per-team country, so flags on the
  // teams pages are accurate rather than inferred from the competition.
  const country = entry.team?.country?.trim() || null;

  return {
    id: entry.team?.id ?? 0,
    name: teamNameAr(original),
    nameOriginal: original,
    logo: entry.team?.logo ?? null,
    country,
    countryCode: countryCode(country),
    founded: entry.team?.founded ? String(entry.team.founded) : null,
    stadium: entry.venue?.name?.trim() || null,
    // Would need a second request against standings; left honest rather than
    // guessed, and the list sorts alphabetically instead.
    tablePosition: null,
    leagueName,
  };
}

export async function getLeagueTeams(leagueId: number): Promise<{
  league: LeagueRef | null;
  teams: TeamSummary[];
  meta: ApiMeta;
}> {
  const cached = await getCached(
    `sh-league-teams:${leagueId}:${currentSeason()}`,
    async () => {
      const body = await apiFetch<RawTeamsBody>("/teams/getTeams", {
        league: leagueId,
        season: currentSeason(),
      });
      return isEmpty(body) ? [] : body.allTeams ?? [];
    },
    { ttlSeconds: CACHE_TTL.leagueTeams, priority: "normal" },
  );

  const teams = cached.value
    .filter((entry) => entry.team?.id)
    .map((entry) => normalizeTeamSummary(entry, null))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));

  return {
    // The teams endpoint carries no league object; the league page supplies the
    // heading, so this stays null rather than inventing one.
    league: null,
    teams,
    meta: meta(
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

export async function getTeamPage(
  teamId: number,
): Promise<{ page: TeamPage; meta: ApiMeta; nowUnix: number } | null> {
  const cached = await getCached(
    `sh-team:${teamId}:${currentSeason()}`,
    async () => {
      // Two requests: the profile, and the team's season fixtures. Fetching a
      // whole season at once is one request rather than separate "next" and
      // "last" calls, and upcoming/recent are then split locally for free.
      const [profileBody, fixturesBody] = await Promise.all([
        apiFetch<RawTeamsBody>("/teams/getTeams", { id: teamId }),
        apiFetch<unknown>("/fixtures/getFixtures", {
          team: teamId,
          season: currentSeason(),
        }),
      ]);
      return {
        profile: isEmpty(profileBody) ? null : profileBody.allTeams?.[0] ?? null,
        fixtures: asFixtureList(fixturesBody),
      };
    },
    { ttlSeconds: CACHE_TTL.team, priority: "normal" },
  );

  const profile = cached.value.profile;
  if (!profile?.team?.id) return null;

  const nowUnix = trueNowUnix();
  const liveMap = await getLiveMap();
  const all = cached.value.fixtures.map((raw) =>
    normalizeMatch(mergeLive(raw, liveMap.get(raw.fixture?.id ?? -1))),
  );

  const upcoming = all
    .filter((m) => m.status === "scheduled" && m.kickoffUnix >= nowUnix)
    .sort((a, b) => a.kickoffUnix - b.kickoffUnix)
    .slice(0, 8);

  const recent = all
    .filter((m) => m.status === "finished" || m.status === "live")
    .sort((a, b) => b.kickoffUnix - a.kickoffUnix)
    .slice(0, 8);

  return {
    page: { team: normalizeTeamSummary(profile, null), upcoming, recent },
    nowUnix,
    meta: meta(
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

interface RawProfilePlayer {
  id?: number;
  name?: string;
  firstname?: string | null;
  lastname?: string | null;
  photo?: string | null;
  /** Present on the ESPN source; absent on API-Football profiles. */
  team?: string | null;
}

/**
 * Minimum query length.
 *
 * The two backend sources disagree: ESPN accepts 3 characters, API-Football
 * requires 4. This uses the lower bound because the backend enforces its own
 * minimum locally, without spending an upstream request to be told the query is
 * too short — so a 3-character query is free either way and simply returns
 * nothing on the stricter source.
 */
export const PLAYER_SEARCH_MIN_LENGTH = 3;

export async function searchPlayers(query: string): Promise<{
  players: PlayerSearchResult[];
  /** False when this backend has no player index at all. */
  available: boolean;
  meta: ApiMeta;
}> {
  const trimmed = query.trim();
  if (trimmed.length < PLAYER_SEARCH_MIN_LENGTH) {
    return { players: [], available: true, meta: meta(true, 0, false) };
  }

  const cached = await getCached(
    `sh-players:${trimmed.toLowerCase()}`,
    async () => {
      let body: { players?: RawProfilePlayer[] };
      try {
        body = await apiFetch<{ players?: RawProfilePlayer[] }>(
          "/players/searchPlayers",
          { search: trimmed },
        );
      } catch (error) {
        /**
         * 501 means the backend's data source has no player index — the case
         * when it scrapes web pages, which carry player names inside match
         * events but no searchable directory. Returned as `null` (not `[]`) so
         * the UI can say the feature is unavailable here rather than claiming
         * the search found nobody.
         */
        if (error instanceof SelfHostedError && error.status === 501) return null;
        throw error;
      }
      return (body.players ?? [])
        .filter((player) => player.id)
        .map((player) => {
          const full =
            [player.firstname, player.lastname]
              .filter(Boolean)
              .join(" ")
              .trim() || player.name?.trim() || "—";
          return {
            id: player.id as number,
            name: player.name?.trim() || full,
            fullName: full,
            logo: player.photo ?? null,
            team: player.team?.trim() || null,
          };
        });
    },
    { ttlSeconds: 24 * 60 * 60, priority: "normal" },
  );

  return {
    players: cached.value ?? [],
    // `false` only when the backend reported the feature as unsupported, so the
    // UI can distinguish that from a search that genuinely matched nobody.
    available: cached.value !== null,
    meta: meta(
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

interface RawScorerEntry {
  player?: RawProfilePlayer & { nationality?: string | null };
  statistics?: Array<{
    team?: RawTeamSide;
    games?: { appearences?: number | null };
    goals?: { total?: number | null; assists?: number | null };
    penalty?: { scored?: number | null };
  }>;
}

/**
 * League top scorers.
 *
 * This is the capability whose absence the league page used to apologise for:
 * none of the three previous providers had a leaderboard endpoint at all.
 */
export async function getLeagueScorers(
  leagueId: number,
): Promise<{ scorers: LeagueScorers; meta: ApiMeta }> {
  const cached = await getCached(
    `sh-scorers:${leagueId}:${currentSeason()}`,
    async () => {
      try {
        const body = await apiFetch<{
          topScorers?: RawScorerEntry[];
          error?: string;
        }>("/players/getTopScorers", { league: leagueId, season: currentSeason() });
        return isEmpty(body) ? [] : body.topScorers ?? [];
      } catch (error) {
        /**
         * 501 means the backend's current data source has no leaderboard
         * endpoint — which is the case when it runs on ESPN. That is a
         * capability gap, not a failure, and it is deliberately distinct from an
         * empty list: `null` lets the UI say "not offered here" instead of
         * implying nobody has scored. Cached like any other answer so the
         * question is not re-asked on every page view.
         */
        if (error instanceof SelfHostedError && error.status === 501) return null;
        throw error;
      }
    },
    { ttlSeconds: CACHE_TTL.standings, priority: "normal" },
  );

  if (cached.value === null) {
    return {
      scorers: { available: false, seasonYear: currentSeason(), scorers: [] },
      meta: meta(
        cached.fromCache,
        cached.ageSeconds,
        cached.budgetBlocked,
        cached.error,
      ),
    };
  }

  const scorers: TopScorer[] = cached.value
    .filter((entry) => entry.player?.id)
    .map((entry, index) => {
      // A player can appear for several teams in one season; the first entry is
      // the one the leaderboard ranked them on.
      const stat = entry.statistics?.[0];
      const teamName = stat?.team?.name?.trim() || null;
      const nationality = entry.player?.nationality?.trim() || null;

      return {
        rank: index + 1,
        player: {
          id: entry.player!.id as number,
          name: entry.player?.name?.trim() || "—",
          photo: entry.player?.photo ?? null,
          nationality,
          countryCode: countryCode(nationality),
        },
        team: teamName
          ? {
              id: stat?.team?.id ?? 0,
              name: teamNameAr(teamName),
              nameOriginal: teamName,
              logo: stat?.team?.logo ?? null,
              country: null,
              countryCode: null,
            }
          : null,
        goals: num(stat?.goals?.total),
        assists: num(stat?.goals?.assists),
        appearances: num(stat?.games?.appearences),
        penalties: num(stat?.penalty?.scored),
      };
    });

  return {
    scorers: { available: true, seasonYear: currentSeason(), scorers },
    meta: meta(
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}
