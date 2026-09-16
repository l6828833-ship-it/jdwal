/**
 * Pure sorting and grouping helpers.
 *
 * Deliberately separate from `lib/sports-api.ts` so the client can import them
 * without dragging the server-only HTTP layer (and the API key lookup) into the
 * browser bundle. Filtering and grouping happen client-side on already-fetched
 * data, which costs zero extra upstream requests.
 */

import { isCarriedLeague, leaguePopularity } from "./config";
import type { LeagueRef, Match } from "./types";

export interface LeagueGroup {
  league: LeagueRef;
  popularityRank: number;
  isPopular: boolean;
  matches: Match[];
}

/** Kickoff time, then home team name, for a stable order inside a league. */
export function compareMatches(a: Match, b: Match): number {
  if (a.kickoffUnix !== b.kickoffUnix) return a.kickoffUnix - b.kickoffUnix;
  return a.home.name.localeCompare(b.home.name, "ar");
}

/**
 * Group matches by league: pinned popular leagues first in the configured
 * order, then every other league alphabetically by Arabic name.
 */
export function groupByLeague(matches: Match[]): LeagueGroup[] {
  const groups = new Map<number, LeagueGroup>();

  for (const match of matches) {
    /**
     * Competitions the site does not carry never reach a list.
     *
     * Filtered HERE rather than at the provider, so one rule covers every screen
     * that groups fixtures — the home page, the day API and the league page all
     * come through this function. Filtering in the provider would have meant the
     * counts in the filter tabs disagreeing with the list underneath them.
     */
    if (!isCarriedLeague(match.league.id, match.league.nameOriginal)) continue;

    let group = groups.get(match.league.id);
    if (!group) {
      const { rank } = leaguePopularity(match.league.id, match.league.nameOriginal);
      group = {
        league: match.league,
        popularityRank: rank,
        isPopular: Number.isFinite(rank),
        matches: [],
      };
      groups.set(match.league.id, group);
    }
    group.matches.push(match);
  }

  const list = [...groups.values()];
  for (const group of list) group.matches.sort(compareMatches);

  list.sort((a, b) => {
    if (a.popularityRank !== b.popularityRank) {
      return a.popularityRank - b.popularityRank;
    }
    return a.league.name.localeCompare(b.league.name, "ar");
  });

  return list;
}

/** True when the match belongs to a pinned popular league (the "Top" tab). */
export function isPopularMatch(match: Match): boolean {
  const { rank } = leaguePopularity(match.league.id, match.league.nameOriginal);
  return Number.isFinite(rank);
}

/**
 * Is this match in a competition the site carries at all? See `isCarriedLeague`.
 *
 * Exported so a caller can apply the same filter BEFORE counting. `groupByLeague`
 * drops these on its own, but a count taken from the raw list would then disagree
 * with the list rendered under it.
 */
export function isCarriedMatch(match: Match): boolean {
  return isCarriedLeague(match.league.id, match.league.nameOriginal);
}
