/**
 * Provider selector.
 *
 * Pages and route handlers import data functions from here, never from a
 * provider module directly, so switching backends is an env change:
 *
 *   SPORTS_PROVIDER=selfhosted    (default — your own SportScore backend)
 *   SPORTS_PROVIDER=highlightly   (100 req/DAY)
 *   SPORTS_PROVIDER=footballdata  (1000 req/month, 5 leagues free)
 *   SPORTS_PROVIDER=rapidapi      (live clock only, 100 req/MONTH)
 *
 * `selfhosted` is the default because it is the only backend that serves EVERY
 * capability from ONE set of ids. That last part mattered more than it sounds:
 * the three hosted providers each had different gaps, so the app used to run
 * three of them at once — fixtures from one, standings and player search pinned
 * to Highlightly, leagues and teams pinned to Footballdata.io.
 *
 * That produced a genuine, silent bug. The competition and team ids are not
 * shared between providers, so a team link built from a Highlightly standings
 * row resolved against a Footballdata team page and landed on the wrong club or
 * a 404. Routing everything through one backend removes that whole class of
 * failure, which is why nothing below is pinned any more.
 *
 * The hosted providers are kept intact as fallbacks; every function still
 * degrades the same way it did before when one of them is selected.
 */

import * as footballdata from "./sports-api";
import * as rapidapi from "./rapidapi";
import * as highlightly from "./highlightly";
import * as selfhosted from "./selfhosted";
// Trusted clock (network-resolved UTC), never the host's system clock.
import { ensureTrueTime, nowUnix as trueNowUnix } from "./true-time";
import type { ApiMeta, LeagueScorers, PlayerSearchResult } from "./types";

export type ProviderName =
  | "selfhosted"
  | "highlightly"
  | "footballdata"
  | "rapidapi";

export function activeProvider(): ProviderName {
  switch (process.env.SPORTS_PROVIDER) {
    case "footballdata":
      return "footballdata";
    case "rapidapi":
      return "rapidapi";
    case "highlightly":
      return "highlightly";
    default:
      return "selfhosted";
  }
}

/**
 * Whether the selected backend is configured enough to try.
 *
 * For `selfhosted` this is always true: the API-Football key lives in the
 * backend, not here, so a missing key surfaces as the backend's own explicit
 * message rather than this app guessing at a variable name.
 */
export function hasApiKey(): boolean {
  switch (activeProvider()) {
    case "footballdata":
      return footballdata.hasApiKey();
    case "rapidapi":
      return rapidapi.hasRapidApiKey();
    case "highlightly":
      return highlightly.hasHighlightlyKey();
    default:
      return selfhosted.hasKey();
  }
}

/**
 * Guarantee a trusted clock before any data is shaped.
 *
 * Every function below stamps or interprets a time: the `nowUnix` the client
 * anchors its live minute to, whether a fixture has kicked off, whether a
 * "live" one has run long enough to be treated as over, which season to query.
 * All of that has to be measured against real UTC, not the host machine's idea
 * of it (see lib/true-time.ts).
 *
 * It goes here rather than in each provider's `apiFetch` because a CACHE HIT
 * skips the upstream call entirely and still re-derives every one of those
 * values — so the fetch path is not the boundary that matters. This is: the
 * module every page and route handler already goes through.
 *
 * Costs a network round trip once per process, then nothing: the anchor is
 * reused until it goes stale, and a stale one refreshes in the background
 * without holding up a request.
 */
async function withTrueTime<T>(work: () => Promise<T>): Promise<T> {
  await ensureTrueTime();
  return work();
}

export function getMatchesByDate(
  dateKey: string,
  todayKeyValue: string,
  background = false,
) {
  return withTrueTime(() => dispatchMatchesByDate(dateKey, todayKeyValue, background));
}

function dispatchMatchesByDate(
  dateKey: string,
  todayKeyValue: string,
  background: boolean,
) {
  switch (activeProvider()) {
    case "footballdata":
      return footballdata.getMatchesByDate(dateKey, todayKeyValue, background);
    case "rapidapi":
      return rapidapi.getMatchesByDate(dateKey, todayKeyValue, background);
    case "highlightly":
      return highlightly.getMatchesByDate(dateKey, todayKeyValue, background);
    default:
      return selfhosted.getMatchesByDate(dateKey, todayKeyValue, background);
  }
}

export function getMatchDetail(matchId: number) {
  return withTrueTime(() => {
    switch (activeProvider()) {
      case "footballdata":
        return footballdata.getMatchDetail(matchId);
      case "rapidapi":
        return rapidapi.getMatchDetail(matchId);
      case "highlightly":
        return highlightly.getMatchDetail(matchId);
      default:
        return selfhosted.getMatchDetail(matchId);
    }
  });
}

export function getLeagueStandings(leagueId: number, season?: number) {
  // Wrapped for the season default: with no explicit `season`, the backend is
  // queried for the year the clock says it is, and a wrong year returns an
  // empty table for every competition.
  return withTrueTime(() => {
    switch (activeProvider()) {
      case "footballdata":
        return footballdata.getLeagueStandings(leagueId);
      // RapidAPI has no standings endpoint, so it borrows Highlightly's.
      case "rapidapi":
      case "highlightly":
        return highlightly.getLeagueStandings(leagueId);
      default:
        return selfhosted.getLeagueStandings(leagueId, season);
    }
  });
}

/**
 * A competition's recent + upcoming matches, for the league page.
 *
 * Only the self-hosted backend exposes this; the hosted providers return an
 * empty set so the page simply shows no fixtures section under them.
 */
export function getLeagueFixtures(leagueId: number) {
  return withTrueTime(async () => {
    if (activeProvider() === "selfhosted") {
      return selfhosted.getLeagueFixtures(leagueId);
    }
    return emptyLeagueFixtures();
  });
}

function emptyLeagueFixtures() {
  return {
    matches: [],
    isCup: false,
    nowUnix: trueNowUnix(),
    meta: {
      plan: null,
      requestsUsed: null,
      requestsLimit: null,
      fromCache: true,
      budgetBlocked: false,
      ageSeconds: 0,
    },
  };
}

export function getLeagues() {
  switch (activeProvider()) {
    case "footballdata":
      return footballdata.getLeagues();
    case "rapidapi":
    case "highlightly":
      return highlightly.getLeagues();
    default:
      return selfhosted.getLeagues();
  }
}

/**
 * Whether the active backend can serve standings for PAST seasons.
 *
 * Only the self-hosted backend can answer honestly (it reads its own upstream
 * capability from `/health`). The hosted providers are queried for the current
 * season only, so a season picker under them would be misleading — report false
 * and let the league page hide the selector.
 */
export function supportsHistoricalSeasons(): Promise<boolean> {
  if (activeProvider() === "selfhosted") {
    return selfhosted.supportsHistoricalSeasons();
  }
  return Promise.resolve(false);
}

/**
 * Player name search.
 *
 * `available: false` means the backend has no player index at all — the case when
 * the self-hosted server scrapes web pages, which carry player names inside match
 * events but no searchable directory. Kept distinct from an empty result so the
 * UI never reports "no matches" for a feature that was never asked.
 */
export async function searchPlayers(query: string): Promise<{
  players: PlayerSearchResult[];
  available: boolean;
  meta: ApiMeta;
}> {
  if (activeProvider() === "selfhosted") {
    return selfhosted.searchPlayers(query);
  }
  const result = await highlightly.searchPlayers(query);
  return { ...result, available: true };
}

export function hasPlayerSearch(): boolean {
  return activeProvider() === "selfhosted"
    ? selfhosted.hasKey()
    : highlightly.hasHighlightlyKey();
}

/**
 * League scorer leaderboard.
 *
 * Only the self-hosted backend can answer this — none of the three hosted APIs
 * exposes a per-league leaderboard, which is why the league page used to carry
 * a permanent "unavailable" card. `available: false` keeps that honest
 * explanation for the fallback providers instead of rendering an empty table.
 */
export function getLeagueScorers(
  leagueId: number,
): Promise<{ scorers: LeagueScorers; meta: ApiMeta }> {
  // Season-scoped, like standings: see getLeagueStandings.
  return withTrueTime(async () => {
    if (activeProvider() === "selfhosted") {
      return selfhosted.getLeagueScorers(leagueId);
    }
    return unavailableScorers();
  });
}

function unavailableScorers(): { scorers: LeagueScorers; meta: ApiMeta } {
  return {
    scorers: { available: false, seasonYear: null, scorers: [] },
    meta: {
      plan: null,
      requestsUsed: null,
      requestsLimit: null,
      fromCache: true,
      budgetBlocked: false,
      ageSeconds: 0,
    },
  };
}

/**
 * Team browsing.
 *
 * Under `selfhosted` these use the same ids as everything else. Under any hosted
 * provider they fall back to Footballdata.io, which is the only one of the three
 * with a usable roster API — and the reason the Teams page has to pair its
 * league tabs with Footballdata league ids in that mode.
 */
export function getLeagueTeams(leagueId: number) {
  // Season-scoped: a roster is requested for a specific year.
  return withTrueTime(() =>
    activeProvider() === "selfhosted"
      ? selfhosted.getLeagueTeams(leagueId)
      : footballdata.getLeagueTeams(leagueId),
  );
}

export function getTeamPage(teamId: number) {
  // Season-scoped AND returns fixtures, so it stamps match times too.
  return withTrueTime(() =>
    activeProvider() === "selfhosted"
      ? selfhosted.getTeamPage(teamId)
      : footballdata.getTeamPage(teamId),
  );
}

/**
 * League list for the Teams page tabs.
 *
 * Must return ids that `getLeagueTeams` above will recognise, which is why it
 * cannot simply reuse `getLeagues()` when a hosted provider is active.
 */
export function getTeamBrowseLeagues() {
  return activeProvider() === "selfhosted"
    ? selfhosted.getLeagues()
    : footballdata.getLeagues();
}

export function isPlanGatedError(error: unknown): boolean {
  // A self-hosted backend has no plan tiers; it serves whatever its key covers.
  if (activeProvider() === "selfhosted") return false;
  return footballdata.isPlanGatedError(error);
}
