/**
 * Pure sorting and grouping helpers.
 *
 * Deliberately separate from `lib/sports-api.ts` so the client can import them
 * without dragging the server-only HTTP layer (and the API key lookup) into the
 * browser bundle. Filtering and grouping happen client-side on already-fetched
 * data, which costs zero extra upstream requests.
 */

import { leaguePopularity } from "./config";
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
