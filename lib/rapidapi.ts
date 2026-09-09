/**
 * RapidAPI "Free API Live Football Data" provider.
 *
 * Produces the SAME domain types as `lib/sports-api.ts` (Footballdata.io), so
 * either can back the app. Select with `SPORTS_PROVIDER` — see `lib/provider.ts`.
 *
 * Why you would use this one: it is FotMob-derived and gives two things
 * Footballdata.io cannot.
 *   • A real match clock (`status.liveTime.short` = "44’"), so the minute stops
 *     being an estimate derived from kickoff.
 *   • Explicit `started` / `finished` / `ongoing` / `cancelled` booleans, which
 *     remove the ambiguity where an un-ingested fixture is indistinguishable
 *     from a real 0-0.
 * Coverage is also far wider (Saudi, Iraqi and 2000+ leagues vs 5).
 *
 * Why it is not the default:
 *   • The BASIC plan is 100 requests PER MONTH (verified from
 *     `x-ratelimit-requests-*`). Footballdata.io gives 1000.
 *   • Match objects carry `leagueId` only — no league name. The ids are
 *     season-stage ids (943230), while `/football-get-all-leagues` returns
 *     parent competition ids (42) and only international ones, so nothing
 *     resolves from it. Names must be fetched per stage id, which is why
 *     `CACHE_TTL_LEAGUE_NAME` is effectively permanent: stage ids never change,
 *     so the cost is paid once per competition rather than once per page view.
 *   • No standings, venue, referee or match-stats endpoint could be located
 *     (~60 endpoint names probed). Those features fall back to Footballdata.io.
 */

import { CACHE_TTL } from "./config";
import { getCached, recordUpstreamUsage } from "./cache";
import { countryCode } from "./countries";
import { leagueNameAr, stageAr, teamNameAr } from "./i18n";
import { resolveBroadcast } from "./broadcast";
import { compareMatches } from "./grouping";
import { statusLabelAr } from "./clock";
// Trusted clock (network-resolved UTC), never the host's system clock.
import { nowUnix as trueNowUnix } from "./true-time";
import type {
  ApiMeta,
  LeagueRef,
  Match,
  MatchDetail,
  MatchStatus,
  Score,
  TeamRef,
} from "./types";

const BASE_URL = "https://free-api-live-football-data.p.rapidapi.com";
const HOST = "free-api-live-football-data.p.rapidapi.com";

/**
 * Stage ids and their names are immutable, so cache for a year. This is what
 * makes the provider affordable: the per-competition name lookup is paid once.
 */
const CACHE_TTL_LEAGUE_NAME = 365 * 24 * 60 * 60;

/** FotMob's CDN serves crests by id; the API payload carries no logo URLs. */
const TEAM_LOGO = (id: number) =>
  `https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png`;
const LEAGUE_LOGO = (id: number) =>
  `https://images.fotmob.com/image_resources/logo/leaguelogo/dark/${id}.png`;

// ---------------------------------------------------------------------------
// Raw shapes
// ---------------------------------------------------------------------------

interface RawSide {
  id: number;
  score?: number | null;
  name?: string;
  longName?: string;
}

interface RawLiveTime {
  short?: string;
  long?: string;
  maxTime?: number;
  addedTime?: number;
}

interface RawStatus {
  utcTime?: string;
  periodLength?: number;
  started?: boolean;
  finished?: boolean;
  cancelled?: boolean;
  ongoing?: boolean;
  scoreStr?: string;
  liveTime?: RawLiveTime;
  halfs?: { firstHalfStarted?: string; secondHalfStarted?: string };
}

interface RawMatch {
  id: number;
  leagueId?: number;
  time?: string;
  home?: RawSide;
  away?: RawSide;
  statusId?: number;
  tournamentStage?: string;
  status?: RawStatus;
  timeTS?: number;
}

interface RawEnvelope<T> {
  status?: string;
  message?: string;
  response?: T;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export class RapidApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RapidApiError";
    this.status = status;
  }
}

export function hasRapidApiKey(): boolean {
  return Boolean(process.env.RAPIDAPI_KEY);
}

async function apiFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    throw new RapidApiError("RAPIDAPI_KEY is not set. Add it to .env.local.", 401);
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
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": HOST,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw new RapidApiError(
      `Network error calling ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      503,
    );
  }

  // RapidAPI reports the real quota in headers; feed the shared budget guard so
  // a 100/month plan cannot be drained silently.
  const limit = Number(response.headers.get("x-ratelimit-requests-limit"));
  const remaining = Number(
    response.headers.get("x-ratelimit-requests-remaining"),
  );
  if (Number.isFinite(limit) && Number.isFinite(remaining)) {
    recordUpstreamUsage(limit - remaining, limit);
  }

  if (!response.ok) {
    throw new RapidApiError(
      `Request to ${path} failed (HTTP ${response.status})`,
      response.status,
    );
  }

  const body = (await response.json()) as RawEnvelope<T>;

  // Note: this API answers HTTP 200 with {status:"failed"} for bad parameters,
  // and those responses still consume quota, so they must be surfaced loudly.
  if (body?.status !== "success" || body.response === undefined) {
    throw new RapidApiError(
      body?.message || `Unexpected response from ${path}`,
      502,
    );
  }

  return body.response;
}

// ---------------------------------------------------------------------------
// League name resolution
// ---------------------------------------------------------------------------

interface RawLeagueListItem {
  id?: number;
  name?: string;
  localizedName?: string;
  ccode?: string;
  logo?: string;
}

interface RawLeagueList {
  leagues?: RawLeagueListItem[];
}

/**
 * Parent-competition id -> name, from ONE call, cached for a year.
 *
 * ⚠️ Do NOT reintroduce a per-league-id lookup here.
 *
 * `/football-get-league-detail` only accepts PARENT competition ids (47), but
 * fixtures reference season-STAGE ids (943230), for which it answers HTTP 200
 * with `{"status":"failed"}` — and RapidAPI bills those failures. Fanning out
 * over the ~48 distinct stage ids in a single day of fixtures therefore spends
 * ~48 requests and returns nothing. On the 100/month BASIC plan that empties
 * the budget in one page view; this was measured, not theorised.
 *
 * So names are resolved only from this single list, and unmatched ids fall back
 * to a neutral label. See the README for why that makes this provider unsuitable
 * for league-grouped fixtures without a manual id map.
 */
async function getParentLeagueMap(): Promise<Map<number, string>> {
  try {
    const cached = await getCached(
      "rapid-all-leagues",
      async () => {
        const data = await apiFetch<RawLeagueList>("/football-get-all-leagues");
        return (data.leagues ?? [])
          .filter((l): l is RawLeagueListItem & { id: number } =>
            typeof l.id === "number",
          )
          .map((l) => [l.id, (l.localizedName || l.name || "").trim()] as const)
          .filter(([, name]) => name.length > 0);
      },
      { ttlSeconds: CACHE_TTL_LEAGUE_NAME, priority: "normal" },
    );
    return new Map(cached.value);
  } catch {
    return new Map();
  }
}

/** Neutral label for a competition this provider won't name. */
const UNNAMED_LEAGUE = "مسابقة أخرى";

async function buildLeagueMap(
  raws: RawMatch[],
): Promise<Map<number, { name: string; country: string | null }>> {
  const parents = await getParentLeagueMap();
  const ids = [...new Set(raws.map((m) => m.leagueId).filter(Boolean))] as number[];

  return new Map(
    ids.map((id) => [
      id,
      { name: parents.get(id) ?? UNNAMED_LEAGUE, country: null },
    ]),
  );
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function mapStatus(status: RawStatus | undefined): MatchStatus {
  if (!status) return "unknown";
  if (status.cancelled) return "cancelled";
  if (status.finished) return "finished";
  if (status.started) return "live";
  return "scheduled";
}

/** Parse the provider's clock, e.g. "44’" or "90+2’". */
function parseMinute(status: RawStatus | undefined): number | null {
  const short = status?.liveTime?.short;
  if (!short) return null;
  const match = /(\d+)(?:\s*\+\s*(\d+))?/.exec(short);
  if (!match) return null;
  const base = Number(match[1]);
  const added = match[2] ? Number(match[2]) : 0;
  return Number.isFinite(base) ? base + added : null;
}

function normalizeTeam(side: RawSide | undefined): TeamRef {
  const original = side?.longName?.trim() || side?.name?.trim() || "—";
  return {
    id: side?.id ?? 0,
    name: teamNameAr(original),
    nameOriginal: original,
    logo: side?.id ? TEAM_LOGO(side.id) : null,
    // This API carries no team nationality on fixtures.
    country: null,
    countryCode: null,
  };
}

function normalizeScore(raw: RawMatch, status: MatchStatus): Score {
  // `started` is authoritative here, so unlike Footballdata.io there is no
  // ambiguity about whether 0-0 is real.
  const confirmed = status === "live" || status === "finished";
  return {
    home: typeof raw.home?.score === "number" ? raw.home.score : null,
    away: typeof raw.away?.score === "number" ? raw.away.score : null,
    halftimeHome: null,
    halftimeAway: null,
    confirmed,
  };
}

function normalizeMatch(
  raw: RawMatch,
  leagues: Map<number, { name: string; country: string | null }>,
): Match {
  const leagueId = raw.leagueId ?? 0;
  const resolved = leagues.get(leagueId);
  const leagueOriginal = resolved?.name ?? `#${leagueId}`;
  const leagueCountry = resolved?.country ?? null;

  const league: LeagueRef = {
    id: leagueId,
    name: leagueNameAr(leagueId, leagueOriginal),
    nameOriginal: leagueOriginal,
    country: leagueCountry,
    countryCode: countryCode(leagueCountry),
    logo: leagueId ? LEAGUE_LOGO(leagueId) : null,
  };

  const status = mapStatus(raw.status);
  const minute = status === "live" ? parseMinute(raw.status) : null;
  const isHalfTime = Boolean(
    status === "live" &&
      raw.status?.halfs?.firstHalfStarted &&
      !raw.status?.halfs?.secondHalfStarted &&
      minute != null &&
      minute >= 45,
  );

  const kickoffUnix = raw.timeTS
    ? Math.floor(raw.timeTS / 1000)
    : raw.status?.utcTime
      ? Math.floor(Date.parse(raw.status.utcTime) / 1000)
      : 0;

  const gameWeek = Number(raw.tournamentStage);

  return {
    id: raw.id,
    kickoff: new Date(kickoffUnix * 1000).toISOString(),
    kickoffUnix,
    status,
    statusLabel: statusLabelAr(status, minute, isHalfTime),
    minute,
    isHalfTime,
    league,
    home: normalizeTeam(raw.home),
    away: normalizeTeam(raw.away),
    score: normalizeScore(raw, status),
    // Not provided by this API.
    venue: null,
    round: {
      stage: Number.isFinite(gameWeek) ? stageAr(gameWeek, leagueOriginal) : null,
      gameWeek: Number.isFinite(gameWeek) ? gameWeek : null,
      roundId: null,
    },
    referee: null,
    broadcast: resolveBroadcast(raw.id, leagueId, leagueOriginal),
  };
}

function meta(
  fromCache: boolean,
  ageSeconds: number,
  budgetBlocked: boolean,
  error?: string,
): ApiMeta {
  return {
    plan: "rapidapi",
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

/** "2026-09-09" -> "20260909" */
function toProviderDate(dateKey: string): string {
  return dateKey.replaceAll("-", "");
}

interface RawMatchList {
  matches?: RawMatch[];
}

interface RawLiveList {
  live?: RawMatch[];
}

/** Live fixtures, keyed by id. One call covers every live match. */
async function getLiveMap(): Promise<Map<number, RawMatch>> {
  try {
    const cached = await getCached(
      "rapid-live",
      async () => {
        const data = await apiFetch<RawLiveList>("/football-current-live");
        return data.live ?? [];
      },
      { ttlSeconds: CACHE_TTL.live, priority: "high" },
    );
    return new Map(cached.value.map((m) => [m.id, m]));
  } catch {
    return new Map();
  }
}

export async function getMatchesByDate(
  dateKey: string,
  todayKeyValue: string,
  background = false,
): Promise<{ matches: Match[]; meta: ApiMeta; nowUnix: number }> {
  const isToday = dateKey === todayKeyValue;

  const cached = await getCached(
    `rapid-matches:${dateKey}`,
    async () => {
      const data = await apiFetch<RawMatchList>("/football-get-matches-by-date", {
        date: toProviderDate(dateKey),
      });
      return data.matches ?? [];
    },
    {
      ttlSeconds: isToday
        ? CACHE_TTL.today
        : dateKey < todayKeyValue
          ? CACHE_TTL.past
          : CACHE_TTL.future,
      priority: background ? "background" : isToday ? "high" : "normal",
    },
  );

  // Overlay the live feed so in-progress scores and clocks are never staler
  // than the poll interval, even though the day list is cached for longer.
  const liveMap = isToday ? await getLiveMap() : new Map<number, RawMatch>();
  const merged = cached.value.map((raw) => liveMap.get(raw.id) ?? raw);

  const leagues = await buildLeagueMap(merged);
  const matches = merged.map((raw) => normalizeMatch(raw, leagues));
  matches.sort(compareMatches);

  return {
    matches,
    nowUnix: trueNowUnix(),
    meta: meta(cached.fromCache, cached.ageSeconds, cached.budgetBlocked, cached.error),
  };
}

interface RawMatchDetail {
  detail?: {
    matchId?: string;
    leagueId?: number;
    leagueName?: string;
    matchRound?: string;
    homeTeam?: { id?: number; name?: string };
    awayTeam?: { id?: number; name?: string };
    matchTimeUTCDate?: string;
    started?: boolean;
    finished?: boolean;
  };
}

/**
 * Single match.
 *
 * This provider's detail endpoint is thin — no venue, referee, stats or score —
 * so the live feed is used for score and clock where available.
 */
export async function getMatchDetail(
  matchId: number,
): Promise<{ match: MatchDetail; meta: ApiMeta; nowUnix: number } | null> {
  const cached = await getCached(
    `rapid-match:${matchId}`,
    async () => {
      const data = await apiFetch<RawMatchDetail>("/football-get-match-detail", {
        // The parameter is `eventid`; `matchid` returns {status:"failed"}.
        eventid: matchId,
      });
      return data.detail ?? null;
    },
    { ttlSeconds: CACHE_TTL.matchDetail, priority: "high" },
  );

  const detail = cached.value;
  if (!detail?.matchId) return null;

  const liveMap = await getLiveMap();
  const live = liveMap.get(matchId);

  const raw: RawMatch =
    live ?? {
      id: matchId,
      leagueId: detail.leagueId,
      home: { id: detail.homeTeam?.id ?? 0, name: detail.homeTeam?.name },
      away: { id: detail.awayTeam?.id ?? 0, name: detail.awayTeam?.name },
      tournamentStage: detail.matchRound,
      status: {
        utcTime: detail.matchTimeUTCDate,
        started: detail.started,
        finished: detail.finished,
      },
      timeTS: detail.matchTimeUTCDate
        ? Date.parse(detail.matchTimeUTCDate)
        : undefined,
    };

  const leagues = new Map<number, { name: string; country: string | null }>();
  if (detail.leagueId) {
    leagues.set(detail.leagueId, {
      name: detail.leagueName?.trim() || `#${detail.leagueId}`,
      country: null,
    });
  }

  const base = normalizeMatch(raw, leagues);

  return {
    match: { ...base, stats: null },
    nowUnix: trueNowUnix(),
    meta: meta(cached.fromCache, cached.ageSeconds, cached.budgetBlocked, cached.error),
  };
}
