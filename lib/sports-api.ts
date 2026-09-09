/**
 * Footballdata.io data layer — the ONLY file that knows about the provider.
 *
 * Everything above this file consumes the provider-agnostic types in
 * `lib/types.ts`. Swapping to API-Football, TheSportsDB or Sportradar means
 * rewriting this file's `apiFetch` + normalizers and nothing else.
 *
 * Provider quirks handled here, all verified against live responses:
 *
 *  • Different key names for the same field between endpoints:
 *      list   -> venue.stadium_name / venue.stadium_location / score.total_goals
 *      detail -> venue.name         / venue.location         / score.total
 *      list   -> league.name ("Europe UEFA Champions League") + competition_name
 *      detail -> league.league_name ("UEFA Champions League")
 *  • `-1` is the "no data" sentinel in stats and attendance, not a real value.
 *  • Timestamps are UTC with no offset in the string; `date_unix` is authoritative.
 *  • No referee field exists on any endpoint -> `referee` is always null.
 *  • No match clock exists -> the live minute is DERIVED from kickoff.
 *  • `lang=ar` is accepted but content comes back English -> Arabic is ours.
 *  • Team country is present on detail and on /leagues/{id}/teams, but NOT on
 *    fixture lists, so list rows get country via a long-cached team map.
 */

import { CACHE_TTL } from "./config";
import { getCached, recordUpstreamUsage } from "./cache";
import {
  countryCode,
  countryFromVenueLocation,
} from "./countries";
import { leagueNameAr, stageAr, teamNameAr } from "./i18n";
import { resolveBroadcast } from "./broadcast";
import { parseProviderDate } from "./date";
import { hasQualifyingPhase, leaguePopularity } from "./config";
import { compareMatches } from "./grouping";
// Trusted clock (network-resolved UTC), never the host's system clock.
import { nowUnix as trueNowUnix } from "./true-time";
import {
  MAX_MATCH_WINDOW_MINUTES,
  deriveClock,
  statusLabelAr,
} from "./clock";
import type {
  ApiMeta,
  LeagueRef,
  LeagueStandings,
  LeagueSummary,
  StandingRow,
  Match,
  MatchDetail,
  MatchStats,
  MatchStatus,
  Score,
  StatPair,
  TeamPage,
  TeamRef,
  TeamSummary,
  Venue,
} from "./types";

const BASE_URL =
  process.env.FOOTBALLDATA_BASE_URL || "https://footballdata.io/api/v1";

// ---------------------------------------------------------------------------
// Raw provider shapes (internal, intentionally loose where the API is loose)
// ---------------------------------------------------------------------------

interface RawEnvelope<T> {
  success: boolean;
  data: T;
  meta?: {
    plan?: string;
    requests_used?: number;
    requests_limit?: number;
    requests_remaining?: number;
    league_limit?: number;
    count?: number;
  };
  error?: { code?: string; message?: string };
}

interface RawTeam {
  team_id: number;
  team_name?: string;
  team_name_clean?: string;
  full_name?: string;
  team_logo?: string | null;
  country?: string | null;
}

interface RawLeague {
  league_id: number;
  /** List endpoints: country-prefixed, e.g. "Europe UEFA Champions League". */
  name?: string;
  /** Detail endpoint uses this key instead. */
  league_name?: string;
  /** List endpoints only: the clean competition name. */
  competition_name?: string;
  country?: string | null;
  image?: string | null;
  league_image?: string | null;
}

interface RawScore {
  home?: number | null;
  away?: number | null;
  total?: number | null;
  total_goals?: number | null;
  halftime_home?: number | null;
  halftime_away?: number | null;
}

interface RawVenue {
  name?: string | null;
  stadium_name?: string | null;
  location?: string | null;
  stadium_location?: string | null;
  attendance?: number | null;
}

interface RawMatch {
  match_id: number;
  match_date?: string;
  date_unix?: number;
  status?: string;
  status_localized?: string;
  round_id?: number | null;
  game_week?: number | null;
  league?: RawLeague;
  home_team?: RawTeam;
  away_team?: RawTeam;
  score?: RawScore;
  venue?: RawVenue;
  stats?: RawStats;
}

interface RawStatTriple {
  home?: number | null;
  away?: number | null;
}

interface RawStats {
  possession?: RawStatTriple;
  shots?: {
    home_total?: number | null;
    away_total?: number | null;
    home_on_target?: number | null;
    away_on_target?: number | null;
  };
  cards?: {
    home_yellow?: number | null;
    away_yellow?: number | null;
    home_red?: number | null;
    away_red?: number | null;
  };
  corners?: RawStatTriple;
  fouls?: RawStatTriple;
  offsides?: RawStatTriple;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export class SportsApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "SportsApiError";
    this.status = status;
    this.code = code;
  }
}

export function hasApiKey(): boolean {
  return Boolean(process.env.FOOTBALLDATA_API_KEY);
}

/**
 * True when the provider refused because the resource sits in a competition
 * outside the current plan (HTTP 403 `not_available_on_plan`).
 *
 * This is routine on the free plan, which covers only 5 leagues, so it gets a
 * proper explanation in the UI rather than a generic failure.
 */
export function isPlanGatedError(error: unknown): boolean {
  return (
    error instanceof SportsApiError &&
    (error.code === "not_available_on_plan" || error.status === 403)
  );
}

async function apiFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<RawEnvelope<T>> {
  const key = process.env.FOOTBALLDATA_API_KEY;
  if (!key) {
    throw new SportsApiError(
      "FOOTBALLDATA_API_KEY is not set. Add it to .env.local.",
      401,
      "missing_api_key",
    );
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
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      // We manage caching ourselves in lib/cache.ts so the monthly quota can
      // be accounted for precisely; Next's fetch cache must not double-layer.
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw new SportsApiError(
      `Network error calling ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      503,
      "network_error",
    );
  }

  let body: RawEnvelope<T> | null = null;
  try {
    body = (await response.json()) as RawEnvelope<T>;
  } catch {
    throw new SportsApiError(
      `Malformed JSON from ${path} (HTTP ${response.status})`,
      response.status,
      "bad_response",
    );
  }

  // Record the authoritative quota numbers even on error responses.
  recordUpstreamUsage(body?.meta?.requests_used, body?.meta?.requests_limit);

  if (!response.ok || !body?.success) {
    throw new SportsApiError(
      body?.error?.message || `Request to ${path} failed (HTTP ${response.status})`,
      response.status,
      body?.error?.code,
    );
  }

  return body;
}

function metaFrom(
  envelopeMeta: RawEnvelope<unknown>["meta"] | undefined,
  fromCache: boolean,
  ageSeconds: number,
  budgetBlocked: boolean,
  error?: string,
): ApiMeta {
  return {
    plan: envelopeMeta?.plan ?? null,
    requestsUsed: envelopeMeta?.requests_used ?? null,
    requestsLimit: envelopeMeta?.requests_limit ?? null,
    fromCache,
    budgetBlocked,
    ageSeconds,
    error,
  };
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  nbsp: " ",
};

/**
 * The provider HTML-escapes names ("Brighton &amp; Hove Albion"), which would
 * otherwise be rendered literally and break name matching.
 */
function decodeEntities(value: string): string {
  return value.replace(/&(#?\w+);/g, (whole, entity: string) => {
    const named = HTML_ENTITIES[entity.toLowerCase()];
    if (named) return named;
    const numeric = /^#(\d+)$/.exec(entity);
    if (numeric) return String.fromCodePoint(Number(numeric[1]));
    const hex = /^#x([0-9a-f]+)$/i.exec(entity);
    if (hex) return String.fromCodePoint(parseInt(hex[1], 16));
    return whole;
  });
}

/** Trim, decode entities and collapse whitespace; null for empty results. */
function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;
  const clean = decodeEntities(value).replace(/\s+/g, " ").trim();
  return clean || null;
}

/** The provider uses -1 for "no data"; convert to null. */
function num(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0) return null;
  return value;
}

function pair(home: number | null | undefined, away: number | null | undefined): StatPair {
  return { home: num(home), away: num(away) };
}

function mapStatus(raw: string | undefined): MatchStatus {
  const s = (raw ?? "").toLowerCase();
  if (!s) return "unknown";
  if (s.includes("complete") && !s.includes("incomplete")) return "finished";
  if (s.includes("finish") || s === "ft") return "finished";
  if (s.includes("live") || s.includes("progress") || s.includes("playing")) return "live";
  if (s.includes("half")) return "live";
  if (s.includes("suspend")) return "live";
  if (s.includes("postpon")) return "postponed";
  if (s.includes("cancel") || s.includes("abandon")) return "cancelled";
  if (s.includes("incomplete") || s.includes("schedul") || s.includes("not started")) {
    return "scheduled";
  }
  return "unknown";
}

function normalizeLeague(raw: RawLeague | undefined): LeagueRef {
  const id = raw?.league_id ?? 0;
  // Prefer the clean competition name; fall back to detail's league_name, then
  // to the country-prefixed list name.
  const original =
    cleanText(raw?.competition_name) ||
    cleanText(raw?.league_name) ||
    cleanText(raw?.name) ||
    "—";
  const country = cleanText(raw?.country);

  return {
    id,
    name: leagueNameAr(id, original),
    nameOriginal: original,
    country,
    countryCode: countryCode(country),
    logo: raw?.image ?? raw?.league_image ?? null,
  };
}

function normalizeTeam(
  raw: RawTeam | undefined,
  countryFallback: string | null,
): TeamRef {
  const original =
    cleanText(raw?.team_name) ||
    cleanText(raw?.team_name_clean) ||
    cleanText(raw?.full_name) ||
    "—";
  const country = cleanText(raw?.country) ?? countryFallback ?? null;

  return {
    id: raw?.team_id ?? 0,
    name: teamNameAr(original),
    nameOriginal: original,
    logo: raw?.team_logo ?? null,
    country,
    countryCode: countryCode(country),
  };
}

function normalizeScore(raw: RawScore | undefined, confirmed: boolean): Score {
  return {
    home: num(raw?.home),
    away: num(raw?.away),
    halftimeHome: num(raw?.halftime_home),
    halftimeAway: num(raw?.halftime_away),
    confirmed,
  };
}

function normalizeVenue(
  raw: RawVenue | undefined,
  /**
   * Home team's country code. Venue addresses are free text with no country
   * field ("Barcelona, Catalonia"), so when the address doesn't name a country
   * we fall back to the home side's country — correct for club football, and
   * the only case it misses is a neutral venue.
   */
  homeCountryCode: string | null,
): Venue | null {
  // Key names differ between the list and detail endpoints.
  const name = raw?.name ?? raw?.stadium_name ?? null;
  const location = raw?.location ?? raw?.stadium_location ?? null;
  if (!name && !location) return null;

  return {
    name: cleanText(name),
    location: cleanText(location),
    countryCode: countryFromVenueLocation(location) ?? homeCountryCode,
    attendance: num(raw?.attendance),
  };
}

function normalizeStats(raw: RawStats | undefined): MatchStats | null {
  if (!raw) return null;

  const stats: MatchStats = {
    possession: pair(raw.possession?.home, raw.possession?.away),
    shotsTotal: pair(raw.shots?.home_total, raw.shots?.away_total),
    shotsOnTarget: pair(raw.shots?.home_on_target, raw.shots?.away_on_target),
    yellowCards: pair(raw.cards?.home_yellow, raw.cards?.away_yellow),
    redCards: pair(raw.cards?.home_red, raw.cards?.away_red),
    corners: pair(raw.corners?.home, raw.corners?.away),
    fouls: pair(raw.fouls?.home, raw.fouls?.away),
    offsides: pair(raw.offsides?.home, raw.offsides?.away),
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
    ] as StatPair[]
  ).some((p) => p.home !== null || p.away !== null);

  return stats;
}

interface NormalizeContext {
  /** Match ids the provider's live feed currently reports as in progress. */
  liveIds?: Set<number>;
  /** team_id -> country, from the long-cached league roster map. */
  teamCountries?: Map<number, string>;
  nowUnix?: number;
}

function normalizeMatch(raw: RawMatch, ctx: NormalizeContext = {}): Match {
  const nowUnix = ctx.nowUnix ?? trueNowUnix();

  const kickoffUnix =
    (typeof raw.date_unix === "number" && raw.date_unix > 0
      ? raw.date_unix
      : raw.match_date
        ? parseProviderDate(raw.match_date)
        : null) ?? 0;

  const league = normalizeLeague(raw.league);

  const providerStatus = mapStatus(raw.status);
  let status = providerStatus;
  const isInLiveFeed = ctx.liveIds?.has(raw.match_id) ?? false;
  const minutesSinceKickoff = Math.floor((nowUnix - kickoffUnix) / 60);

  /**
   * The score is only real when the provider says the match is complete, or is
   * actively reporting it as live. A fixture still marked "incomplete" carries
   * 0-0 placeholders, not a result.
   */
  const scoreConfirmed = providerStatus === "finished" || isInLiveFeed;

  if (isInLiveFeed && status !== "finished") {
    status = "live";
  } else if (
    status === "scheduled" &&
    kickoffUnix > 0 &&
    minutesSinceKickoff >= 0
  ) {
    // Kickoff has passed but the provider still says "incomplete".
    // Within a plausible match window the match is being played; beyond it, it
    // has certainly finished even if the provider hasn't updated the status.
    status =
      minutesSinceKickoff <= MAX_MATCH_WINDOW_MINUTES ? "live" : "finished";
  }

  const clock =
    status === "live" && kickoffUnix > 0
      ? deriveClock(kickoffUnix, nowUnix)
      : { minute: null, isHalfTime: false, elapsed: 0 };

  const teamCountry = (team: RawTeam | undefined): string | null => {
    if (!team) return null;
    if (team.country) return team.country;
    const mapped = ctx.teamCountries?.get(team.team_id);
    return mapped ?? null;
  };

  const home = normalizeTeam(raw.home_team, teamCountry(raw.home_team));
  const away = normalizeTeam(raw.away_team, teamCountry(raw.away_team));

  return {
    id: raw.match_id,
    kickoff: new Date(kickoffUnix * 1000).toISOString(),
    kickoffUnix,
    status,
    statusLabel: statusLabelAr(status, clock.minute, clock.isHalfTime),
    minute: clock.minute,
    isHalfTime: clock.isHalfTime,
    league,
    home,
    away,
    score: normalizeScore(raw.score, scoreConfirmed),
    venue: normalizeVenue(raw.venue, home.countryCode),
    round: {
      stage: stageAr(raw.game_week ?? null, league.nameOriginal),
      gameWeek: raw.game_week ?? null,
      roundId: raw.round_id ?? null,
    },
    // Footballdata.io exposes no referee on any endpoint.
    referee: null,
    broadcast: resolveBroadcast(raw.match_id, league.id, league.nameOriginal),
  };
}

// ---------------------------------------------------------------------------
// Team country enrichment (for flags on fixture list rows)
// ---------------------------------------------------------------------------

interface RawPagination {
  page?: number;
  limit?: number;
  total?: number;
  total_pages?: number;
}

interface RawLeagueTeams {
  teams?: Array<{ team_id: number; country?: string | null }>;
}

/** Hard ceiling on roster pages so a bad `total_pages` can't drain the quota. */
const MAX_ROSTER_PAGES = 4;

/**
 * Fetch every page of a league roster.
 *
 * This endpoint paginates at 50 while a continental competition can list 129+
 * teams across two seasons, so a single-page fetch silently loses most teams
 * (and therefore most flags).
 */
async function fetchAllLeagueTeams<T extends { teams?: unknown[] }>(
  leagueId: number,
): Promise<{ pages: RawEnvelope<T>[] }> {
  const first = await apiFetch<T>(`/leagues/${leagueId}/teams`, { limit: 100 });
  const pagination = (first.meta as { pagination?: RawPagination } | undefined)
    ?.pagination;
  const totalPages = Math.min(pagination?.total_pages ?? 1, MAX_ROSTER_PAGES);

  const pages: RawEnvelope<T>[] = [first];
  for (let page = 2; page <= totalPages; page++) {
    pages.push(
      await apiFetch<T>(`/leagues/${leagueId}/teams`, { limit: 100, page }),
    );
  }
  return { pages };
}

/**
 * team_id -> country for one league, cached for 30 days (team nationality is
 * effectively static). Failures are swallowed: flags are a nice-to-have and
 * must never break the fixture list.
 */
async function getLeagueTeamCountries(leagueId: number): Promise<Map<number, string>> {
  try {
    const result = await getCached(
      `league-teams:${leagueId}`,
      async () => {
        const { pages } = await fetchAllLeagueTeams<RawLeagueTeams>(leagueId);
        const map: Array<[number, string]> = [];
        for (const page of pages) {
          for (const team of page.data?.teams ?? []) {
            if (team.country) map.push([team.team_id, team.country]);
          }
        }
        return map;
      },
      { ttlSeconds: CACHE_TTL.leagueTeams, priority: "normal" },
    );
    return new Map(result.value);
  } catch {
    return new Map();
  }
}

async function buildTeamCountryMap(
  raws: RawMatch[],
): Promise<Map<number, string>> {
  const leagueIds = new Set<number>();
  for (const raw of raws) {
    // Only look up leagues where at least one team lacks a country.
    const missing = !raw.home_team?.country || !raw.away_team?.country;
    if (missing && raw.league?.league_id) leagueIds.add(raw.league.league_id);
  }
  if (leagueIds.size === 0) return new Map();

  const maps = await Promise.all([...leagueIds].map(getLeagueTeamCountries));
  const merged = new Map<number, string>();
  for (const map of maps) {
    for (const [id, country] of map) merged.set(id, country);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface RawMatchList {
  date?: string;
  matches?: RawMatch[];
}

/**
 * The provider's live feed, keyed by match id and cached on the poll interval.
 *
 * This is the freshest source of in-progress scores. The per-day fixture list is
 * cached far longer (5 minutes for today), so live entries are overlaid onto it
 * — otherwise a goal could take minutes to appear. Both reads share this one
 * cached call, so the overlay costs no extra requests.
 */
async function getLiveRawMap(): Promise<Map<number, RawMatch>> {
  try {
    const result = await getCached(
      "live-raw",
      async () => {
        const body = await apiFetch<RawMatchList>("/fixtures/live");
        return body.data?.matches ?? [];
      },
      { ttlSeconds: CACHE_TTL.live, priority: "high" },
    );
    return new Map(result.value.map((match) => [match.match_id, match]));
  } catch {
    return new Map();
  }
}

/** Overlay the live feed's score and status onto a cached fixture entry. */
function mergeLive(base: RawMatch, live: RawMatch | undefined): RawMatch {
  if (!live) return base;
  return {
    ...base,
    status: live.status ?? base.status,
    status_localized: live.status_localized ?? base.status_localized,
    score: live.score ?? base.score,
    stats: live.stats ?? base.stats,
  };
}

function ttlForDate(dateKey: string, todayKeyValue: string): number {
  if (dateKey === todayKeyValue) return CACHE_TTL.today;
  return dateKey < todayKeyValue ? CACHE_TTL.past : CACHE_TTL.future;
}

/** All matches on a calendar day, plus quota metadata. */
export async function getMatchesByDate(
  dateKey: string,
  todayKeyValue: string,
  background = false,
): Promise<{ matches: Match[]; meta: ApiMeta; nowUnix: number }> {
  const isToday = dateKey === todayKeyValue;

  const cached = await getCached(
    `matches:${dateKey}`,
    async () => {
      const body = await apiFetch<RawMatchList>(`/matches/date/${dateKey}`, {
        limit: 100,
      });
      return { raws: body.data?.matches ?? [], envMeta: body.meta };
    },
    {
      ttlSeconds: ttlForDate(dateKey, todayKeyValue),
      priority: background ? "background" : isToday ? "high" : "normal",
    },
  );

  // Live status only matters for today; skip the extra call otherwise.
  const [liveRaws, teamCountries] = await Promise.all([
    isToday ? getLiveRawMap() : Promise.resolve(new Map<number, RawMatch>()),
    buildTeamCountryMap(cached.value.raws),
  ]);

  const liveIds = new Set(liveRaws.keys());
  const nowUnix = trueNowUnix();
  const matches = cached.value.raws.map((raw) =>
    normalizeMatch(mergeLive(raw, liveRaws.get(raw.match_id)), {
      liveIds,
      teamCountries,
      nowUnix,
    }),
  );
  matches.sort(compareMatches);

  return {
    matches,
    nowUnix,
    meta: metaFrom(
      cached.value.envMeta,
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

/** One match with stats. */
export async function getMatchDetail(
  matchId: number,
): Promise<{ match: MatchDetail; meta: ApiMeta; nowUnix: number } | null> {
  let cached;
  try {
    cached = await getCached(
      `match:${matchId}`,
      async () => {
        const body = await apiFetch<RawMatch>(`/matches/${matchId}`);
        return { raw: body.data, envMeta: body.meta };
      },
      { ttlSeconds: CACHE_TTL.matchDetail, priority: "high" },
    );
  } catch (error) {
    if (error instanceof SportsApiError && error.status === 404) return null;
    throw error;
  }

  const cachedRaw = cached.value.raw;
  if (!cachedRaw?.match_id) return null;

  // Detail is cached for 2 minutes; overlay the 60s live feed so an in-progress
  // score is never stale by more than the poll interval.
  const liveRaws = await getLiveRawMap();
  const raw = mergeLive(cachedRaw, liveRaws.get(cachedRaw.match_id));
  const liveIds = new Set(liveRaws.keys());
  const nowUnix = trueNowUnix();
  const base = normalizeMatch(raw, { liveIds, nowUnix });

  return {
    match: { ...base, stats: normalizeStats(raw.stats) },
    nowUnix,
    meta: metaFrom(
      cached.value.envMeta,
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

interface RawLeagueListItem {
  league_id: number;
  league_name: string;
  country?: string | null;
  league_image?: string | null;
  seasons_available?: number | null;
  latest_season?: number | null;
}

/** Leagues available on the current plan, popular ones first. */
export async function getLeagues(): Promise<{
  leagues: LeagueSummary[];
  meta: ApiMeta;
}> {
  const cached = await getCached(
    "leagues",
    async () => {
      const body = await apiFetch<RawLeagueListItem[]>("/leagues");
      return { raws: body.data ?? [], envMeta: body.meta };
    },
    { ttlSeconds: CACHE_TTL.leagues, priority: "normal" },
  );

  const leagues: LeagueSummary[] = cached.value.raws.map((raw) => {
    const { rank } = leaguePopularity(raw.league_id, raw.league_name);
    return {
      id: raw.league_id,
      name: leagueNameAr(raw.league_id, raw.league_name),
      nameOriginal: raw.league_name,
      country: raw.country ?? null,
      countryCode: countryCode(raw.country),
      logo: raw.league_image ?? null,
      seasonsAvailable: raw.seasons_available ?? null,
      latestSeason: raw.latest_season ?? null,
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
    meta: metaFrom(
      cached.value.envMeta,
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

interface RawLeagueTeamsFull {
  league?: RawLeague;
  teams?: Array<{
    team_id: number;
    team_name?: string;
    team_name_clean?: string;
    full_name?: string;
    team_logo?: string | null;
    country?: string | null;
    founded?: string | null;
    stadium?: { name?: string | null } | null;
    standing?: { table_position?: number | null } | null;
  }>;
}

/** Teams in a league, ordered by table position when available. */
export async function getLeagueTeams(leagueId: number): Promise<{
  league: LeagueRef | null;
  teams: TeamSummary[];
  meta: ApiMeta;
}> {
  const cached = await getCached(
    `league-teams-full:${leagueId}`,
    async () => {
      const { pages } = await fetchAllLeagueTeams<RawLeagueTeamsFull>(leagueId);
      const teams = pages.flatMap((page) => page.data?.teams ?? []);
      return {
        raw: { league: pages[0]?.data?.league, teams } as RawLeagueTeamsFull,
        envMeta: pages[0]?.meta,
      };
    },
    { ttlSeconds: CACHE_TTL.leagueTeams, priority: "normal" },
  );

  const raw = cached.value.raw;
  const league = raw?.league ? normalizeLeague(raw.league) : null;

  // The roster can span several seasons; keep the newest entry per team.
  const seen = new Map<number, TeamSummary>();
  for (const team of raw?.teams ?? []) {
    const original =
      cleanText(team.team_name) ||
      cleanText(team.team_name_clean) ||
      cleanText(team.full_name) ||
      "—";
    const summary: TeamSummary = {
      id: team.team_id,
      name: teamNameAr(original),
      nameOriginal: original,
      logo: team.team_logo ?? null,
      country: cleanText(team.country),
      countryCode: countryCode(team.country),
      founded: cleanText(team.founded),
      stadium: cleanText(team.stadium?.name),
      tablePosition: num(team.standing?.table_position),
      leagueName: league?.name ?? null,
    };
    const existing = seen.get(team.team_id);
    if (!existing || (summary.tablePosition ?? 99) < (existing.tablePosition ?? 99)) {
      seen.set(team.team_id, summary);
    }
  }

  const teams = [...seen.values()].sort((a, b) => {
    const ap = a.tablePosition ?? Number.POSITIVE_INFINITY;
    const bp = b.tablePosition ?? Number.POSITIVE_INFINITY;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name, "ar");
  });

  return {
    league,
    teams,
    meta: metaFrom(
      cached.value.envMeta,
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

interface RawStandingRow {
  position?: number;
  team?: RawTeam & { team_name_clean?: string };
  record?: {
    matches_played?: number | null;
    wins?: number | null;
    draws?: number | null;
    losses?: number | null;
    points?: number | null;
  };
  goals?: {
    for?: number | null;
    against?: number | null;
    difference?: number | null;
  };
}

interface RawStandings {
  league?: RawLeague;
  season?: { season_id?: number; year?: number };
  standings?: RawStandingRow[];
}

/** Hard ceiling on season-match pages so a bad `total_pages` can't drain quota. */
const MAX_SEASON_MATCH_PAGES = 6;

/** Every match in a season, following pagination. */
async function fetchSeasonMatches(seasonId: number): Promise<RawMatch[]> {
  const first = await apiFetch<RawMatchList>(`/seasons/${seasonId}/matches`, {
    limit: 100,
  });
  const pagination = (first.meta as { pagination?: RawPagination } | undefined)
    ?.pagination;
  const totalPages = Math.min(
    pagination?.total_pages ?? 1,
    MAX_SEASON_MATCH_PAGES,
  );

  const matches = [...(first.data?.matches ?? [])];
  for (let page = 2; page <= totalPages; page++) {
    const next = await apiFetch<RawMatchList>(`/seasons/${seasonId}/matches`, {
      limit: 100,
      page,
    });
    matches.push(...(next.data?.matches ?? []));
  }
  return matches;
}

interface Tally {
  team: RawTeam;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/**
 * Build a table from league-phase fixtures.
 *
 * Only matches the provider marks as finished contribute, so an in-progress or
 * not-yet-ingested fixture (which carries a placeholder 0-0) can never move the
 * table. Teams with no completed match still appear, on zero — which is the
 * correct state for a phase that hasn't kicked off yet.
 *
 * Ordering is points, then goal difference, then goals scored, then name. UEFA's
 * full tiebreaker list goes further (head-to-head, away goals, disciplinary
 * points); those are not derivable here, so equal-on-all-three teams fall back
 * to alphabetical rather than a guessed order.
 */
function computeStandingsFromMatches(matches: RawMatch[]): StandingRow[] {
  const leaguePhase = matches.filter((m) => m.game_week != null);
  const tallies = new Map<number, Tally>();

  const ensure = (team: RawTeam | undefined): Tally | null => {
    if (!team?.team_id) return null;
    let tally = tallies.get(team.team_id);
    if (!tally) {
      tally = {
        team,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      };
      tallies.set(team.team_id, tally);
    }
    return tally;
  };

  for (const match of leaguePhase) {
    const home = ensure(match.home_team);
    const away = ensure(match.away_team);
    if (!home || !away) continue;

    // Only completed matches count. Anything else carries a placeholder score.
    if (mapStatus(match.status) !== "finished") continue;

    const hg = match.score?.home;
    const ag = match.score?.away;
    if (typeof hg !== "number" || typeof ag !== "number") continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += hg;
    home.goalsAgainst += ag;
    away.goalsFor += ag;
    away.goalsAgainst += hg;

    if (hg > ag) {
      home.wins += 1;
      home.points += 3;
      away.losses += 1;
    } else if (hg < ag) {
      away.wins += 1;
      away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const rows = [...tallies.values()].map((tally) => {
    const original =
      cleanText(tally.team.team_name) ||
      cleanText(tally.team.team_name_clean) ||
      cleanText(tally.team.full_name) ||
      "—";
    const country = cleanText(tally.team.country);

    return {
      position: 0,
      team: {
        id: tally.team.team_id,
        name: teamNameAr(original),
        nameOriginal: original,
        logo: tally.team.team_logo ?? null,
        country,
        countryCode: countryCode(country),
      },
      played: tally.played,
      wins: tally.wins,
      draws: tally.draws,
      losses: tally.losses,
      goalsFor: tally.goalsFor,
      goalsAgainst: tally.goalsAgainst,
      goalDifference: tally.goalsFor - tally.goalsAgainst,
      points: tally.points,
    } satisfies StandingRow;
  });

  rows.sort((a, b) => {
    if (b.points !== a.points) return (b.points ?? 0) - (a.points ?? 0);
    if (b.goalDifference !== a.goalDifference) {
      return (b.goalDifference ?? 0) - (a.goalDifference ?? 0);
    }
    if (b.goalsFor !== a.goalsFor) return (b.goalsFor ?? 0) - (a.goalsFor ?? 0);
    return a.team.name.localeCompare(b.team.name, "ar");
  });

  rows.forEach((row, index) => {
    row.position = index + 1;
  });

  return rows;
}

/**
 * League table.
 *
 * Domestic leagues use the provider's table, which is accurate and already
 * accounts for point deductions. Competitions with a qualifying phase have their
 * league-phase table computed from fixtures instead — see `hasQualifyingPhase`
 * for why the provider's version cannot be used there.
 *
 * For the provider path, `goalDifference` is passed through rather than
 * recomputed: it agreed with `for - against` on every row checked, so trusting
 * it keeps the table faithful to the source.
 */
export async function getLeagueStandings(leagueId: number): Promise<{
  standings: LeagueStandings;
  meta: ApiMeta;
} | null> {
  let cached;
  try {
    cached = await getCached(
      `standings:${leagueId}`,
      async () => {
        const body = await apiFetch<RawStandings>(`/leagues/${leagueId}/standings`);
        return { raw: body.data, envMeta: body.meta };
      },
      { ttlSeconds: CACHE_TTL.standings, priority: "normal" },
    );
  } catch (error) {
    if (error instanceof SportsApiError && error.status === 404) return null;
    throw error;
  }

  const raw = cached.value.raw;
  if (!raw) return null;

  const league = raw.league ? normalizeLeague(raw.league) : null;
  const seasonId = raw.season?.season_id ?? null;

  // Competitions with qualifying rounds: derive the league-phase table from
  // fixtures, because the provider's table merges the phases together.
  if (
    league &&
    seasonId &&
    hasQualifyingPhase(league.id, league.nameOriginal)
  ) {
    const derived = await getCached(
      `standings-derived:${leagueId}:${seasonId}`,
      async () => computeStandingsFromMatches(await fetchSeasonMatches(seasonId)),
      { ttlSeconds: CACHE_TTL.standings, priority: "normal" },
    );

    return {
      standings: {
        league,
        seasonYear: raw.season?.year ?? null,
        rows: derived.value,
        source: "computed",
      },
      meta: metaFrom(
        cached.value.envMeta,
        cached.fromCache && derived.fromCache,
        Math.max(cached.ageSeconds, derived.ageSeconds),
        cached.budgetBlocked || derived.budgetBlocked,
        cached.error ?? derived.error,
      ),
    };
  }

  const rows: StandingRow[] = (raw.standings ?? [])
    .map((row) => {
      const original =
        cleanText(row.team?.team_name_clean) ||
        cleanText(row.team?.team_name) ||
        cleanText(row.team?.full_name) ||
        "—";
      const country = cleanText(row.team?.country);

      return {
        position: row.position ?? 0,
        team: {
          id: row.team?.team_id ?? 0,
          name: teamNameAr(original),
          nameOriginal: original,
          logo: row.team?.team_logo ?? null,
          country,
          countryCode: countryCode(country),
        },
        played: num(row.record?.matches_played),
        wins: num(row.record?.wins),
        draws: num(row.record?.draws),
        losses: num(row.record?.losses),
        goalsFor: num(row.goals?.for),
        goalsAgainst: num(row.goals?.against),
        // Goal difference is legitimately negative, so the -1 sentinel guard in
        // `num` must not be applied here.
        goalDifference: row.goals?.difference ?? null,
        points: num(row.record?.points),
      };
    })
    .sort((a, b) => a.position - b.position);

  return {
    standings: {
      league,
      seasonYear: raw.season?.year ?? null,
      rows,
      source: "provider",
    },
    meta: metaFrom(
      cached.value.envMeta,
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}

interface RawTeamDetail {
  team_id?: number;
  team_name?: string;
  team_name_clean?: string;
  full_name?: string;
  team_logo?: string | null;
  country?: string | null;
  founded?: string | null;
  stadium?: { name?: string | null } | null;
}

/** Team profile with upcoming fixtures and recent results. */
export async function getTeamPage(
  teamId: number,
): Promise<{ page: TeamPage; meta: ApiMeta; nowUnix: number } | null> {
  let cached;
  try {
    cached = await getCached(
      `team:${teamId}`,
      async () => {
        const [profile, fixtures] = await Promise.all([
          apiFetch<RawTeamDetail>(`/teams/${teamId}`),
          apiFetch<RawMatchList>(`/teams/${teamId}/matches`, { limit: 60 }),
        ]);
        return {
          profile: profile.data,
          raws: fixtures.data?.matches ?? [],
          envMeta: fixtures.meta,
        };
      },
      { ttlSeconds: CACHE_TTL.team, priority: "normal" },
    );
  } catch (error) {
    if (error instanceof SportsApiError && error.status === 404) return null;
    throw error;
  }

  const profile = cached.value.profile;
  if (!profile?.team_id) return null;

  const nowUnix = trueNowUnix();
  const liveRaws = await getLiveRawMap();
  const liveIds = new Set(liveRaws.keys());
  const all = cached.value.raws.map((raw) =>
    normalizeMatch(mergeLive(raw, liveRaws.get(raw.match_id)), {
      liveIds,
      nowUnix,
    }),
  );

  const upcoming = all
    .filter((m) => m.status === "scheduled" && m.kickoffUnix >= nowUnix)
    .sort((a, b) => a.kickoffUnix - b.kickoffUnix)
    .slice(0, 8);

  const recent = all
    .filter((m) => m.status === "finished" || m.status === "live")
    .sort((a, b) => b.kickoffUnix - a.kickoffUnix)
    .slice(0, 8);

  const original =
    cleanText(profile.team_name) ||
    cleanText(profile.team_name_clean) ||
    cleanText(profile.full_name) ||
    "—";

  return {
    page: {
      team: {
        id: profile.team_id,
        name: teamNameAr(original),
        nameOriginal: original,
        logo: profile.team_logo ?? null,
        country: cleanText(profile.country),
        countryCode: countryCode(profile.country),
        founded: cleanText(profile.founded),
        stadium: cleanText(profile.stadium?.name),
        tablePosition: null,
        leagueName: null,
      },
      upcoming,
      recent,
    },
    nowUnix,
    meta: metaFrom(
      cached.value.envMeta,
      cached.fromCache,
      cached.ageSeconds,
      cached.budgetBlocked,
      cached.error,
    ),
  };
}
