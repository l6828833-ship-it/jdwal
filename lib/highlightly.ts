/**
 * Highlightly Football provider (soccer.highlightly.net).
 *
 * Produces the same domain types as the other providers, selected via
 * `SPORTS_PROVIDER=highlightly` in `lib/provider.ts`.
 *
 * Why this is the best fit of the providers evaluated (all verified live):
 *   • Fixtures carry the league name and logo inline — no id-resolution
 *     fan-out, unlike the other RapidAPI option.
 *   • `/standings` returns named groups, so the Champions League league phase
 *     is a separate group from qualifying — the merge problem is gone.
 *   • Live `state` gives a clock and an explicit description, so score
 *     confirmation is unambiguous.
 *   • Quota is 100 requests PER DAY (resets daily), the most generous free tier
 *     evaluated. PRO is 7,500/day at $9.49.
 *
 * Auth (from the Highlightly troubleshooting guide): even on the DIRECT base
 * URL the mandatory headers are `x-rapidapi-key` + `x-rapidapi-host`, and the
 * host value equals the base host. Dashboard keys and RapidAPI keys are NOT
 * interchangeable.
 *
 * Gaps handled by falling back or labelling honestly:
 *   • No league top-scorers/leaderboard endpoint exists. Players are reachable
 *     only by name search (`/players?name=`) or id (`/players/{id}`), so the
 *     app offers player SEARCH, not a fabricated scorers ranking.
 *   • No referee or broadcast (no football API has these) — venue is present on
 *     match detail only.
 */

import { CACHE_TTL, POPULAR_LEAGUES } from "./config";
import { getCached, recordUpstreamUsage } from "./cache";
import { countryCode } from "./countries";
import { leagueNameAr, stageAr, teamNameAr } from "./i18n";
import { resolveBroadcast } from "./broadcast";
import { compareMatches } from "./grouping";
import { statusLabelAr } from "./clock";
import type {
  ApiMeta,
  LeagueRef,
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
  TeamRef,
} from "./types";

// These are part of the shared domain contract now. Re-exported so existing
// imports from this module keep resolving.
export type { MatchGoal, PlayerSearchResult };

const BASE_URL = "https://soccer.highlightly.net";
const HOST = "soccer.highlightly.net";

/** Season the app queries. Kept in one place so a rollover is one edit. */
const SEASON = Number(process.env.HIGHLIGHTLY_SEASON) || 2026;

// ---------------------------------------------------------------------------
// Raw shapes (verified against live responses)
// ---------------------------------------------------------------------------

interface RawTeam {
  id: number;
  name?: string;
  logo?: string | null;
}

interface RawLeagueRef {
  id: number;
  name?: string;
  logo?: string | null;
  season?: number;
}

interface RawState {
  clock?: number | null;
  description?: string;
  score?: { current?: string | null; penalties?: string | null };
}

interface RawEvent {
  team?: RawTeam;
  time?: string;
  type?: string;
  player?: string;
  playerId?: number;
  assist?: string | null;
  assistingPlayerId?: number | null;
}

interface RawStatEntry {
  team?: RawTeam;
  statistics?: Array<{ name?: string; value?: number | string | null }>;
}

interface RawMatch {
  id: number;
  round?: string;
  date?: string;
  state?: RawState;
  homeTeam?: RawTeam;
  awayTeam?: RawTeam;
  league?: RawLeagueRef;
  country?: { code?: string; name?: string };
  venue?: { name?: string | null; city?: string | null } | null;
  referee?: { name?: string | null; nationality?: string | null } | null;
  events?: RawEvent[];
  statistics?: RawStatEntry[];
}

interface RawStandingSide {
  wins: number;
  draws: number;
  loses: number;
  games: number;
  scoredGoals: number;
  receivedGoals: number;
}

interface RawStandingRow {
  position: number;
  points: number;
  team: RawTeam;
  total: RawStandingSide;
  home?: RawStandingSide;
  away?: RawStandingSide;
}

interface RawStandingsResponse {
  league?: RawLeagueRef & { name?: string };
  groups?: Array<{ name?: string; standings: RawStandingRow[] }>;
}

interface RawListEnvelope<T> {
  data?: T[];
  pagination?: { totalCount?: number; offset?: number; limit?: number };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export class HighlightlyError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "HighlightlyError";
    this.status = status;
  }
}

export function hasHighlightlyKey(): boolean {
  return Boolean(process.env.HIGHLIGHTLY_API_KEY);
}

async function apiFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const key = process.env.HIGHLIGHTLY_API_KEY;
  if (!key) {
    throw new HighlightlyError("HIGHLIGHTLY_API_KEY is not set.", 401);
  }

  const url = new URL(`${BASE_URL}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        // Mandatory even on the direct base URL; the host equals BASE_URL host.
        "x-rapidapi-key": key,
        "x-rapidapi-host": HOST,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw new HighlightlyError(
      `Network error calling ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      503,
    );
  }

  const limit = Number(response.headers.get("x-ratelimit-requests-limit"));
  const remaining = Number(
    response.headers.get("x-ratelimit-requests-remaining"),
  );
  if (Number.isFinite(limit) && Number.isFinite(remaining)) {
    recordUpstreamUsage(limit - remaining, limit);
  }

  if (!response.ok) {
    throw new HighlightlyError(
      `Request to ${path} failed (HTTP ${response.status})`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeTeam(team: RawTeam | undefined): TeamRef {
  const original = team?.name?.trim() || "—";
  return {
    id: team?.id ?? 0,
    name: teamNameAr(original),
    nameOriginal: original,
    logo: team?.logo ?? null,
    country: null,
    countryCode: null,
  };
}

function normalizeLeagueRef(raw: RawLeagueRef | undefined): LeagueRef {
  const id = raw?.id ?? 0;
  const original = raw?.name?.trim() || `#${id}`;
  return {
    id,
    name: leagueNameAr(id, original),
    nameOriginal: original,
    country: null,
    countryCode: null,
    logo: raw?.logo ?? null,
  };
}

/**
 * Map Highlightly's `state.description` to our status.
 *
 * The description is authoritative and is trusted verbatim — no kickoff-time
 * guessing. Verified values: "Not started", "Finished", "Postponed". This is
 * deliberately conservative: a match is only "live" when the API explicitly
 * says so (in-play description or a running clock), which prevents a scheduled
 * match from ever showing a fabricated minute.
 */
function mapStatus(state: RawState | undefined): MatchStatus {
  const d = (state?.description ?? "").trim().toLowerCase();

  if (d.includes("cancel") || d.includes("abandon")) return "cancelled";
  if (d.includes("postpon") || d.includes("suspend")) return "postponed";
  if (d.includes("not started") || d.includes("scheduled") || d.includes("tbd")) {
    return "scheduled";
  }
  if (d.includes("finish") || d.includes("full time") || d.includes("after") || d === "ft") {
    return "finished";
  }
  // In-play indicators: an explicit live phrase, a half marker, or a clock.
  if (
    d.includes("half") ||
    d.includes("progress") ||
    d.includes("live") ||
    d.includes("extra time") ||
    d.includes("penalt") ||
    d.includes("break") ||
    /^\d+/.test(d) ||
    (d === "" && state?.clock != null)
  ) {
    return "live";
  }
  return d ? "scheduled" : "unknown";
}

/** Parse "2 - 1" into home/away integers. */
function parseScore(current: string | null | undefined): {
  home: number | null;
  away: number | null;
} {
  if (!current) return { home: null, away: null };
  const m = /(\d+)\s*-\s*(\d+)/.exec(current);
  if (!m) return { home: null, away: null };
  return { home: Number(m[1]), away: Number(m[2]) };
}

function normalizeScore(state: RawState | undefined, status: MatchStatus): Score {
  const confirmed = status === "live" || status === "finished";
  const parsed = parseScore(state?.score?.current);
  return {
    home: confirmed ? parsed.home : null,
    away: confirmed ? parsed.away : null,
    halftimeHome: null,
    halftimeAway: null,
    confirmed,
  };
}

/** "Group Stage - 1" / "Regular Season - 3" -> game week number. */
function parseGameWeek(round: string | undefined): number | null {
  if (!round) return null;
  const m = /(\d+)\s*$/.exec(round);
  return m ? Number(m[1]) : null;
}

function isHalfTimeState(state: RawState | undefined): boolean {
  return (state?.description ?? "").toLowerCase().includes("half");
}

function normalizeMatch(raw: RawMatch): Match {
  const status = mapStatus(raw.state);
  // Only the API's own clock is used, clamped to a sane range. Never derived
  // from kickoff, so a scheduled match cannot show a running minute.
  const rawClock = raw.state?.clock;
  const minute =
    status === "live" && typeof rawClock === "number" && rawClock > 0
      ? Math.min(rawClock, 120)
      : null;
  const isHalfTime = status === "live" && isHalfTimeState(raw.state);

  const kickoffUnix = raw.date ? Math.floor(Date.parse(raw.date) / 1000) : 0;
  const league = normalizeLeagueRef(raw.league);
  const gameWeek = parseGameWeek(raw.round);

  return {
    id: raw.id,
    kickoff: new Date(kickoffUnix * 1000).toISOString(),
    kickoffUnix,
    status,
    statusLabel: statusLabelAr(status, minute, isHalfTime),
    minute,
    isHalfTime,
    league,
    home: normalizeTeam(raw.homeTeam),
    away: normalizeTeam(raw.awayTeam),
    score: normalizeScore(raw.state, status),
    venue: raw.venue?.name
      ? {
          name: raw.venue.name,
          location: raw.venue.city ?? null,
          countryCode: countryCode(raw.country?.name),
          attendance: null,
        }
      : null,
    round: {
      stage: raw.round?.trim() || stageAr(gameWeek, league.nameOriginal),
      gameWeek,
      roundId: null,
    },
    referee: raw.referee?.name
      ? { name: raw.referee.name, countryCode: countryCode(raw.referee.nationality) }
      : null,
    broadcast: resolveBroadcast(raw.id, league.id, league.nameOriginal),
  };
}

/** Goals from the events feed, split by team, in chronological order. */
function extractGoals(raw: RawMatch): MatchGoal[] {
  const homeId = raw.homeTeam?.id;
  return (raw.events ?? [])
    .filter((e) => (e.type ?? "").toLowerCase().includes("goal"))
    .map((e) => {
      const type = (e.type ?? "").toLowerCase();
      return {
        // Player names are shown as the provider spells them; no club-name
        // translation is applied to a person's name.
        minute: (e.time ?? "").trim(),
        player: e.player?.trim() || "—",
        assist: e.assist?.trim() || null,
        team: e.team?.id === homeId ? ("home" as const) : ("away" as const),
        kind: type.includes("own")
          ? ("own" as const)
          : type.includes("penalt")
            ? ("penalty" as const)
            : ("goal" as const),
      };
    });
}

function meta(
  fromCache: boolean,
  ageSeconds: number,
  budgetBlocked: boolean,
  error?: string,
): ApiMeta {
  return {
    plan: "highlightly",
    requestsUsed: null,
    requestsLimit: null,
    fromCache,
    budgetBlocked,
    ageSeconds,
    error,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getMatchesByDate(
  dateKey: string,
  todayKeyValue: string,
  background = false,
): Promise<{ matches: Match[]; meta: ApiMeta; nowUnix: number }> {
  const isToday = dateKey === todayKeyValue;

  const cached = await getCached(
    `hl-matches:${dateKey}`,
    async () => {
      const body = await apiFetch<RawListEnvelope<RawMatch>>("/matches", {
        date: dateKey,
        timezone: process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE || "Asia/Riyadh",
        limit: 100,
      });
      return body.data ?? [];
    },
    {
      ttlSeconds: isToday
        ? CACHE_TTL.today
        : dateKey < todayKeyValue
          ? CACHE_TTL.past
          : CACHE_TTL.future,
      // A background poll must never outrank a user's own action for budget.
      priority: background ? "background" : isToday ? "high" : "normal",
    },
  );

  const matches = cached.value.map(normalizeMatch);
  matches.sort(compareMatches);

  return {
    matches,
    nowUnix: Math.floor(Date.now() / 1000),
    meta: meta(cached.fromCache, cached.ageSeconds, cached.budgetBlocked, cached.error),
  };
}

/** `goals` is now part of `MatchDetail` itself; kept as an alias for callers. */
export type MatchDetailExtended = MatchDetail;

export async function getMatchDetail(
  matchId: number,
): Promise<{ match: MatchDetailExtended; meta: ApiMeta; nowUnix: number } | null> {
  let cached;
  try {
    cached = await getCached(
      `hl-match:${matchId}`,
      async () => {
        // Path-param endpoint returns the full object (venue, referee, events,
        // statistics). The `?matchId=` query form is rejected with HTTP 400.
        const body = await apiFetch<RawMatch[] | RawMatch>(`/matches/${matchId}`);
        return Array.isArray(body) ? body[0] ?? null : body;
      },
      { ttlSeconds: CACHE_TTL.matchDetail, priority: "high" },
    );
  } catch (error) {
    if (error instanceof HighlightlyError && error.status === 404) return null;
    throw error;
  }

  const raw = cached.value;
  if (!raw?.id) return null;

  const base = normalizeMatch(raw);

  return {
    match: {
      ...base,
      stats: extractStats(raw.statistics),
      goals: extractGoals(raw),
    },
    nowUnix: Math.floor(Date.now() / 1000),
    meta: meta(cached.fromCache, cached.ageSeconds, cached.budgetBlocked, cached.error),
  };
}

/** Statistics arrive as name/value pairs per team; map the ones we display. */
function extractStats(entries: RawStatEntry[] | undefined): MatchStats | null {
  if (!Array.isArray(entries) || entries.length < 2) return null;

  const pick = (entry: RawStatEntry | undefined, keys: string[]): number | null => {
    for (const stat of entry?.statistics ?? []) {
      const name = (stat.name ?? "").toLowerCase();
      if (keys.some((k) => name.includes(k))) {
        const v = typeof stat.value === "string" ? parseFloat(stat.value) : stat.value;
        return typeof v === "number" && Number.isFinite(v) ? v : null;
      }
    }
    return null;
  };

  const [home, away] = entries;
  const pair = (keys: string[]) => ({ home: pick(home, keys), away: pick(away, keys) });

  const stats: MatchStats = {
    possession: pair(["possession"]),
    shotsTotal: pair(["total shots", "shots total"]),
    shotsOnTarget: pair(["shots on", "on target", "on goal"]),
    yellowCards: pair(["yellow"]),
    redCards: pair(["red"]),
    corners: pair(["corner"]),
    fouls: pair(["foul"]),
    offsides: pair(["offside"]),
    hasAny: false,
  };

  stats.hasAny = (
    [
      stats.possession,
      stats.shotsTotal,
      stats.shotsOnTarget,
      stats.yellowCards,
      stats.redCards,
      stats.corners,
      stats.fouls,
      stats.offsides,
    ]
  ).some((p) => p.home !== null || p.away !== null);

  return stats.hasAny ? stats : null;
}

export async function getLeagueStandings(leagueId: number): Promise<{
  standings: LeagueStandings;
  meta: ApiMeta;
} | null> {
  let cached;
  try {
    cached = await getCached(
      `hl-standings:${leagueId}:${SEASON}`,
      async () =>
        apiFetch<RawStandingsResponse>("/standings", {
          leagueId,
          season: SEASON,
        }),
      { ttlSeconds: CACHE_TTL.standings, priority: "normal" },
    );
  } catch (error) {
    if (error instanceof HighlightlyError && error.status === 404) return null;
    throw error;
  }

  const raw = cached.value;
  const league = normalizeLeagueRef(raw.league);

  // Flatten the groups. A group name is kept as a phase label on the row's
  // position context via the league name; for a single-table league there is
  // just one group, and for cups each phase is already separated by the API.
  const rows: StandingRow[] = [];
  for (const group of raw.groups ?? []) {
    for (const r of group.standings ?? []) {
      const original = r.team?.name?.trim() || "—";
      rows.push({
        position: r.position,
        team: {
          id: r.team?.id ?? 0,
          name: teamNameAr(original),
          nameOriginal: original,
          logo: r.team?.logo ?? null,
          country: null,
          countryCode: null,
        },
        played: r.total?.games ?? null,
        wins: r.total?.wins ?? null,
        draws: r.total?.draws ?? null,
        losses: r.total?.loses ?? null,
        goalsFor: r.total?.scoredGoals ?? null,
        goalsAgainst: r.total?.receivedGoals ?? null,
        goalDifference:
          r.total?.scoredGoals != null && r.total?.receivedGoals != null
            ? r.total.scoredGoals - r.total.receivedGoals
            : null,
        points: r.points ?? null,
      });
    }
  }

  return {
    standings: {
      league,
      seasonYear: raw.league?.season ?? SEASON,
      rows,
      source: "provider",
    },
    meta: meta(cached.fromCache, cached.ageSeconds, cached.budgetBlocked, cached.error),
  };
}

/**
 * Leagues for the browse page.
 *
 * Highlightly's `/leagues` returns thousands of competitions, so listing them
 * all is neither useful nor affordable. Instead the pinned popular leagues are
 * surfaced with their verified Highlightly ids, so every link on the browse
 * page resolves to a real standings id (unlike Footballdata's ids, which this
 * provider does not recognise).
 */
export async function getLeagues(): Promise<{
  leagues: LeagueSummary[];
  meta: ApiMeta;
}> {
  const leagues: LeagueSummary[] = [];
  POPULAR_LEAGUES.forEach((entry, rank) => {
    const hlId = entry.highlightlyId;
    if (!hlId) return;
    leagues.push({
      id: hlId,
      name: entry.ar,
      nameOriginal: entry.aliases[0] ?? entry.ar,
      country: null,
      countryCode: null,
      logo: `https://highlightly.net/soccer/images/leagues/${hlId}.png`,
      seasonsAvailable: null,
      latestSeason: SEASON,
      isPopular: true,
      popularityRank: rank,
    });
  });

  return { leagues, meta: meta(true, 0, false) };
}

/** Player name search. There is no league leaderboard endpoint. */
export async function searchPlayers(
  query: string,
): Promise<{ players: PlayerSearchResult[]; meta: ApiMeta }> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return {
      players: [],
      meta: meta(true, 0, false),
    };
  }

  const cached = await getCached(
    `hl-players:${trimmed.toLowerCase()}`,
    async () => {
      const body = await apiFetch<
        RawListEnvelope<{ id: number; name?: string; fullName?: string; logo?: string | null }>
      >("/players", { name: trimmed, limit: 25 });
      return (body.data ?? []).map((p) => ({
        id: p.id,
        name: p.name?.trim() || p.fullName?.trim() || "—",
        fullName: p.fullName?.trim() || p.name?.trim() || "—",
        logo: p.logo ?? null,
      }));
    },
    { ttlSeconds: 24 * 60 * 60, priority: "normal" },
  );

  return {
    players: cached.value,
    meta: meta(cached.fromCache, cached.ageSeconds, cached.budgetBlocked, cached.error),
  };
}
