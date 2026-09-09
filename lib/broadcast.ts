/**
 * ⚠️ EDITORIAL DATA — NOT FROM THE API ⚠️
 *
 * No mainstream football API exposes broadcast channels or commentators —
 * Footballdata.io, API-Football and TheSportsDB all omit them, and only
 * enterprise TV-schedule feeds carry the data. 365scores (the current backend
 * source) has a `hasTVNetworks` flag that varies by country, so it holds the
 * data internally, but the network list itself is not returned by any of its
 * public game or fixture endpoints.
 *
 * So this file is a hand-maintained mapping you own. Nothing here is presented
 * as provider data: `Broadcast.source` is always "editorial", and the UI hides
 * the row entirely when no entry matches.
 *
 * ── What can and cannot be stated at competition level ──────────────────────
 *
 * The NETWORK is a competition-level fact. beIN SPORTS holds MENA rights to the
 * Champions League, so "this match is on beIN SPORTS" is true of every UCL
 * fixture and safe to state without knowing which one you are looking at.
 *
 * A specific CHANNEL NUMBER is not. On a Champions League matchday eight or nine
 * matches kick off simultaneously and are split across beIN SPORTS 1 through 9;
 * which match lands on which number is a per-fixture scheduling decision.
 * Likewise a COMMENTATOR: one person commentates one match.
 *
 * This file previously stored `beIN SPORTS 1` + `عصام الشوالي` against the `ucl`
 * key, which meant every Champions League fixture claimed the same channel and
 * the same commentator. Two matches at the same kickoff both read "beIN SPORTS
 * 1", which is impossible and visibly wrong.
 *
 * So competition entries now carry only the network. A specific channel and
 * commentator come from `MATCH_OVERRIDES` — real, per-fixture facts you enter —
 * or from a competition explicitly marked `exclusive`, meaning it genuinely airs
 * one match at a time on one channel (a final, a super cup) and therefore cannot
 * collide with itself.
 *
 * Keep it current yourself, per season and per region. Rights move often.
 * To disable the feature completely, empty `LEAGUE_BROADCASTS`.
 */

import type { Broadcast } from "./types";
import { leaguePopularity } from "./config";

/** Region these mappings describe. Rights are territory-specific. */
export const BROADCAST_REGION = "الشرق الأوسط وشمال أفريقيا";

interface BroadcastEntry {
  /**
   * The rights-holding network, e.g. "beIN SPORTS". True for every match in the
   * competition, so it is safe to show without knowing the fixture.
   */
  network: string;
  /**
   * A specific channel, only meaningful alongside `exclusive`.
   *
   * Set this ONLY for a competition that airs one match at a time on one
   * channel. For anything with simultaneous kickoffs, leave it out: the number
   * varies per fixture and stating one would be a guess applied to every match.
   */
  channel?: string;
  /**
   * Indicative commentator, only meaningful alongside `exclusive`.
   *
   * Real assignments are per-match and announced late, so for a competition with
   * parallel fixtures this belongs in `MATCH_OVERRIDES`, never here.
   */
  commentator?: string;
  /**
   * True when the competition plays ONE match at a time in this region, so a
   * specific channel cannot be wrong by collision.
   *
   * Deliberately opt-in. Defaulting to "exclusive" is what produced the original
   * bug, and a competition added later is far more likely to have parallel
   * fixtures than not.
   */
  exclusive?: true;
}

/**
 * Keyed by the internal league key from `POPULAR_LEAGUES` in lib/config.ts,
 * plus extra keys matched by name for competitions outside that list.
 *
 * Every entry here has simultaneous fixtures, so all of them state the network
 * only. Even domestic leagues do: a Premier League Saturday afternoon runs
 * several games at once across different beIN channels, and the Saudi league
 * spreads its round across SSC 1/2/3.
 */
const LEAGUE_BROADCASTS: Record<string, BroadcastEntry> = {
  ucl: { network: "beIN SPORTS" },
  uel: { network: "beIN SPORTS" },
  uecl: { network: "beIN SPORTS" },
  "premier-league": { network: "beIN SPORTS" },
  "la-liga": { network: "beIN SPORTS" },
  "serie-a": { network: "beIN SPORTS" },
  bundesliga: { network: "beIN SPORTS" },
  "ligue-1": { network: "beIN SPORTS" },
  "saudi-pro-league": { network: "SSC" },
  mls: { network: "beIN SPORTS" },
  "world-cup": { network: "beIN SPORTS" },
};

/** Name-matched fallbacks for competitions not in the popular list. */
const NAME_BROADCASTS: Array<{ match: RegExp; entry: BroadcastEntry }> = [
  {
    match: /conference league/i,
    entry: { network: "beIN SPORTS" },
  },
  {
    // A one-off final: a single match, so naming the channel cannot collide.
    match: /uefa super cup/i,
    entry: {
      network: "beIN SPORTS",
      channel: "beIN SPORTS 1",
      commentator: "عصام الشوالي",
      exclusive: true,
    },
  },
  {
    match: /afc champions league|دوري أبطال آسيا/i,
    entry: { network: "SSC" },
  },
];

/**
 * Per-match overrides, keyed by the provider's match id. Highest priority, and
 * the ONLY place a specific channel belongs for a competition with parallel
 * fixtures — because here it is attached to one fixture, which is the level the
 * fact actually exists at.
 *
 * Fill these in when a broadcaster publishes a matchday schedule:
 *
 *   4828501: { channel: "beIN SPORTS 2", commentator: "رؤوف خليف" },
 *   4828502: { channel: "beIN SPORTS 3" },
 */
const MATCH_OVERRIDES: Record<
  number,
  { channel: string; commentator?: string }
> = {};

/**
 * Clean up a broadcaster name for display.
 *
 * Upstream names are broadcast branding: "beIN Sport 1 HD", "beIN Sports 3 HD" —
 * inconsistent in both pluralisation and the "HD" suffix, which is noise now that
 * SD simulcasts are gone. Normalising gives "beIN SPORTS 1" for all of them, so a
 * list of channels reads as one family rather than as several spellings.
 *
 * Anything that is not a recognised beIN pattern is passed through untouched: it
 * is a real channel name from the provider and guessing at its formatting would
 * be more likely to mangle it than improve it.
 */
function tidyChannel(name: string): string {
  const beIn = /^be\s*in\s*sports?\s*(\d+)\s*(?:hd|sd)?$/i.exec(name.trim());
  if (beIn) return `beIN SPORTS ${beIn[1]}`;
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Resolve the broadcast line for a match, or null when nothing is known.
 *
 * Resolution order, most specific first:
 *
 *   1. REAL channels from the provider (`known.channels`). 365scores exposes
 *      per-fixture `tvNetworks`, which the self-hosted backend forwards as
 *      `tv_channels`. This is actual data, so it wins outright — it is the only
 *      thing here that can correctly say one of nine simultaneous Champions
 *      League matches is on beIN SPORTS 3 rather than 1.
 *   2. A hand-entered per-match override.
 *   3. The competition entry: a specific channel only if it is `exclusive`,
 *      otherwise the network alone.
 *
 * `channel` is what the UI labels. It carries the specific channel when one is
 * genuinely known for THIS fixture, and otherwise the network — so two
 * simultaneous matches read "beIN SPORTS" rather than both claiming "beIN SPORTS
 * 1". `precise` tells the UI which of the two it got, so it can word the caveat
 * honestly instead of implying a precision it does not have.
 *
 * @param known Per-fixture facts from the provider. `channels` is empty on a
 *   fixture LIST response, which does not carry broadcasters — so the list falls
 *   back to the network and only the detail page shows the real channel.
 */
export function resolveBroadcast(
  matchId: number,
  leagueId: number,
  leagueName: string,
  known: { channels?: string[] | null } = {},
): Broadcast | null {
  const real = (known.channels ?? [])
    .filter((name): name is string => typeof name === "string" && name.trim() !== "")
    .map(tidyChannel);

  if (real.length > 0) {
    return {
      // Several channels can carry one match (a regional split, or a
      // simulcast). Listing all of them is more useful than picking one.
      channel: [...new Set(real)].join(" • "),
      // The provider gives channels, not commentators. An override may still
      // supply one; the competition table must not, or it repeats across every
      // match in the competition.
      commentator: MATCH_OVERRIDES[matchId]?.commentator ?? null,
      precise: true,
      source: "provider",
    };
  }

  const override = MATCH_OVERRIDES[matchId];
  if (override) {
    return {
      channel: override.channel,
      commentator: override.commentator ?? null,
      precise: true,
      source: "editorial",
    };
  }

  const entry = findEntry(leagueId, leagueName);
  if (!entry) return null;

  // Only an explicitly exclusive competition may state a specific channel and
  // commentator from a competition-level entry.
  if (entry.exclusive && entry.channel) {
    return {
      channel: entry.channel,
      commentator: entry.commentator ?? null,
      precise: true,
      source: "editorial",
    };
  }

  // Parallel fixtures: the network is the most specific thing that is true.
  // No commentator — naming one here would repeat it across every match.
  return {
    channel: entry.network,
    commentator: null,
    precise: false,
    source: "editorial",
  };
}

function findEntry(leagueId: number, leagueName: string): BroadcastEntry | null {
  const { entry: popular } = leaguePopularity(leagueId, leagueName);
  if (popular) {
    const byKey = LEAGUE_BROADCASTS[popular.key];
    if (byKey) return byKey;
  }

  for (const { match, entry } of NAME_BROADCASTS) {
    if (match.test(leagueName)) return entry;
  }

  return null;
}
