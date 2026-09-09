/**
 * ⚠️ EDITORIAL DATA — NOT FROM THE API ⚠️
 *
 * Footballdata.io does not expose broadcast channels or commentators, and
 * neither does any other mainstream football API (API-Football, TheSportsDB).
 * Only enterprise TV-schedule feeds carry it.
 *
 * So this file is a hand-maintained mapping you own. Nothing here is presented
 * as provider data: `Broadcast.source` is always "editorial", and the UI hides
 * the channel/commentator row entirely when no entry matches.
 *
 * Keep it current yourself, per season and per region. Rights move often.
 * To disable the feature completely, empty `LEAGUE_BROADCASTS`.
 */

import type { Broadcast } from "./types";
import { leaguePopularity } from "./config";

/** Region these mappings describe. Rights are territory-specific. */
export const BROADCAST_REGION = "الشرق الأوسط وشمال أفريقيا";

interface BroadcastEntry {
  /** Arabic channel name shown in the match info card. */
  channel: string;
  /**
   * Commentator usually assigned to this competition, in Arabic.
   * Indicative only — real assignments are per-match and announced late.
   * Set to null to hide the commentator line for this competition.
   */
  commentator: string | null;
}

/**
 * Keyed by the internal league key from `POPULAR_LEAGUES` in lib/config.ts,
 * plus extra keys matched by name for competitions outside that list.
 */
const LEAGUE_BROADCASTS: Record<string, BroadcastEntry> = {
  ucl: { channel: "beIN SPORTS 1", commentator: "عصام الشوالي" },
  uel: { channel: "beIN SPORTS 2", commentator: "علي محمد علي" },
  "premier-league": { channel: "beIN SPORTS 1", commentator: "يوسف سيف" },
  "la-liga": { channel: "beIN SPORTS 3", commentator: "حفيظ دراجي" },
  "serie-a": { channel: "beIN SPORTS 4", commentator: "عامر عبد الله" },
  bundesliga: { channel: "beIN SPORTS 5", commentator: "خليل البلوشي" },
  "ligue-1": { channel: "beIN SPORTS 6", commentator: "جواد بده" },
  "saudi-pro-league": { channel: "SSC 1", commentator: "فهد العتيبي" },
  mls: { channel: "beIN SPORTS 7", commentator: null },
};

/** Name-matched fallbacks for competitions not in the popular list. */
const NAME_BROADCASTS: Array<{ match: RegExp; entry: BroadcastEntry }> = [
  {
    match: /world cup|كأس العالم/i,
    entry: { channel: "beIN SPORTS 1", commentator: "عصام الشوالي" },
  },
  {
    match: /conference league/i,
    entry: { channel: "beIN SPORTS 3", commentator: null },
  },
  {
    match: /uefa super cup/i,
    entry: { channel: "beIN SPORTS 1", commentator: "عصام الشوالي" },
  },
  {
    match: /afc champions league|دوري أبطال آسيا/i,
    entry: { channel: "SSC 1", commentator: null },
  },
];

/**
 * Per-match overrides, keyed by Footballdata.io match id. Highest priority.
 * Use this when you know the actual broadcast for a specific fixture.
 *
 * Example:
 *   2815360983: { channel: "beIN SPORTS 2", commentator: "رؤوف خليف" },
 */
const MATCH_OVERRIDES: Record<number, BroadcastEntry> = {};

/**
 * Resolve the broadcast line for a match, or null when nothing is configured.
 * Resolution order: per-match override, league key, league name pattern.
 */
export function resolveBroadcast(
  matchId: number,
  leagueId: number,
  leagueName: string,
): Broadcast | null {
  const override = MATCH_OVERRIDES[matchId];
  if (override) {
    return { ...override, source: "editorial" };
  }

  const { entry: popular } = leaguePopularity(leagueId, leagueName);
  if (popular) {
    const byKey = LEAGUE_BROADCASTS[popular.key];
    if (byKey) return { ...byKey, source: "editorial" };
  }

  for (const { match, entry } of NAME_BROADCASTS) {
    if (match.test(leagueName)) return { ...entry, source: "editorial" };
  }

  return null;
}
