/**
 * Domain model for the app.
 *
 * This is the stable contract the UI renders against. It is deliberately
 * independent of any provider's response shape — `lib/sports-api.ts` is the
 * only file that knows about Footballdata.io. Swapping providers means
 * rewriting that one file to produce these same types.
 */

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled"
  | "unknown";

export interface TeamRef {
  id: number;
  /** Display name, Arabic when a translation exists, else the source name. */
  name: string;
  /** Untranslated source name, kept for search and debugging. */
  nameOriginal: string;
  logo: string | null;
  /** Country as named by the provider (English), e.g. "England". */
  country: string | null;
  /** ISO 3166-1 alpha-2, derived from `country`. Drives the flag. */
  countryCode: string | null;
}

export interface LeagueRef {
  id: number;
  name: string;
  nameOriginal: string;
  country: string | null;
  countryCode: string | null;
  logo: string | null;
}

export interface Score {
  home: number | null;
  away: number | null;
  halftimeHome: number | null;
  halftimeAway: number | null;
  /**
   * Whether the provider has actually reported this score.
   *
   * Footballdata.io returns 0-0 for fixtures it has not ingested yet, which is
   * indistinguishable from a real goalless result by value alone. So the score
   * is only trusted when the provider marks the match `complete`, or when the
   * match is in its live feed. Otherwise the UI shows a placeholder rather than
   * presenting 0-0 as a result.
   */
  confirmed: boolean;
}

export interface Venue {
  name: string | null;
  location: string | null;
  countryCode: string | null;
  attendance: number | null;
}

/**
 * Broadcast is NOT provider data. Footballdata.io does not expose TV channels
 * or commentators, and neither does any other mainstream football API.
 * This comes from the editorial config in `lib/broadcast.ts`, and is null
 * whenever no entry is configured.
 */
export interface Broadcast {
  /**
   * What to show as the broadcaster: a specific channel when one is known for
   * this fixture, otherwise the network that holds the rights.
   */
  channel: string;
  commentator: string | null;
  /**
   * True when `channel` names an actual channel for THIS match; false when it is
   * only the network.
   *
   * A specific channel number is a per-fixture fact — a Champions League matchday
   * splits nine simultaneous kickoffs across beIN SPORTS 1-9 — so it can only be
   * stated for a fixture it was recorded against. This flag lets the UI say which
   * it is rather than implying a precision it does not have.
   */
  precise: boolean;
  /**
   * Where the value came from, so the UI can be honest about provenance.
   *
   * "provider" is real per-fixture data (365scores `tvNetworks`, forwarded by the
   * self-hosted backend). "editorial" is the hand-maintained mapping in
   * lib/broadcast.ts, which the app falls back to because no mainstream football
   * API exposes broadcast information.
   */
  source: "provider" | "editorial";
}

export interface MatchRound {
  /** e.g. "دور المجموعات" / "الأسبوع 1" — localized stage or round label. */
  stage: string | null;
  gameWeek: number | null;
  roundId: number | null;
}

export interface StatPair {
  home: number | null;
  away: number | null;
}

export interface MatchStats {
  possession: StatPair;
  shotsTotal: StatPair;
  shotsOnTarget: StatPair;
  yellowCards: StatPair;
  redCards: StatPair;
  corners: StatPair;
  fouls: StatPair;
  offsides: StatPair;
  /** True when the provider returned at least one real value. */
  hasAny: boolean;
}

export interface Match {
  id: number;
  /** ISO 8601 UTC kickoff, e.g. "2026-09-08T16:45:00.000Z". */
  kickoff: string;
  kickoffUnix: number;
  status: MatchStatus;
  /** Localized status label for display. */
  statusLabel: string;
  /**
   * Elapsed minute for live matches.
   *
   * Footballdata.io exposes no match clock, so this is DERIVED from kickoff
   * time and is an estimate, not an official clock. Null when not live.
   */
  minute: number | null;
  /** True while the derived clock sits in the half-time window. */
  isHalfTime: boolean;
  league: LeagueRef;
  home: TeamRef;
  away: TeamRef;
  score: Score;
  venue: Venue | null;
  round: MatchRound;
  /**
   * Not available from Footballdata.io — always null with this provider.
   * Kept in the contract so a provider that does supply it needs no UI change.
   */
  referee: { name: string; countryCode: string | null } | null;
  broadcast: Broadcast | null;
}

/** A scored goal, from a provider's match event feed. */
export interface MatchGoal {
  /** Minute as the provider renders it, e.g. "23" or "90+2". */
  minute: string;
  player: string;
  assist: string | null;
  team: "home" | "away";
  /** "goal" | "own" | "penalty" — own goals must not read as normal goals. */
  kind: "goal" | "own" | "penalty";
}

export interface MatchDetail extends Match {
  stats: MatchStats | null;
  /**
   * Goals in chronological order.
   *
   * `undefined` means the provider exposes no event feed at all, which is not
   * the same as `[]` (a genuine goalless match). The UI relies on that
   * difference to avoid captioning an empty list as "no goals".
   */
  goals?: MatchGoal[];
}

/**
 * Qualification/relegation zone a standings row sits in, for colour-coding.
 *
 *   "champions"  — top continental qualification (green)
 *   "europa"     — second continental competition (blue)
 *   "conference" — third continental competition (teal)
 *   "promotion"  — promoted to a higher division (green)
 *   "playoff"    — promotion/relegation play-off (amber)
 *   "relegation" — relegated / knocked out (red)
 *   null         — no zone
 */
export type StandingZone =
  | "champions"
  | "europa"
  | "conference"
  | "promotion"
  | "playoff"
  | "relegation"
  | null;

export interface StandingRow {
  position: number;
  team: TeamRef;
  /**
   * Phase or group label, e.g. "Group A" / "League Phase".
   *
   * Present only for competitions that are split into several tables. Without
   * it a cup's groups collapse into one meaningless ranking, which is what
   * happened when this field was dropped.
   */
  group?: string | null;
  /** The provider's raw zone label, e.g. "UEFA Champions League". */
  zoneLabel?: string | null;
  /** Classified zone for the green/red colour bands. */
  zone?: StandingZone;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  goalDifference: number | null;
  points: number | null;
}

export interface LeagueStandings {
  league: LeagueRef | null;
  /** Season as the provider labels it, e.g. 20262027. */
  seasonYear: number | null;
  rows: StandingRow[];
  /**
   * "provider" — the API's own table (domestic leagues).
   * "computed" — derived from league-phase fixtures, because the provider's
   * table merges qualifying rounds into the same list. The UI says which.
   */
  source: "provider" | "computed";
}

export interface LeagueSummary extends LeagueRef {
  seasonsAvailable: number | null;
  latestSeason: number | null;
  /** True when the league is in the pinned popular list. */
  isPopular: boolean;
  /** Rank in the popular list, Infinity when unpinned. */
  popularityRank: number;
}

export interface TeamSummary extends TeamRef {
  founded: string | null;
  stadium: string | null;
  tablePosition: number | null;
  leagueName: string | null;
}

export interface TeamPage {
  team: TeamSummary;
  upcoming: Match[];
  recent: Match[];
}

/** A player match from name search. */
export interface PlayerSearchResult {
  id: number;
  name: string;
  fullName: string;
  logo: string | null;
  /**
   * Current club, when the source supplies it. Absent rather than empty for
   * sources that return a bare profile, and worth showing when present: a name
   * search for a common surname returns many players, and the club is what
   * tells them apart.
   */
  team?: string | null;
}

/** One row of a scorers or assists leaderboard. */
export interface TopScorer {
  rank: number;
  player: {
    id: number;
    name: string;
    photo: string | null;
    nationality: string | null;
    countryCode: string | null;
  };
  team: TeamRef | null;
  goals: number | null;
  assists: number | null;
  appearances: number | null;
  penalties: number | null;
}

/**
 * League leaderboards.
 *
 * A provider that has no leaderboard endpoint returns `available: false` rather
 * than an empty list, so the UI can say "not offered here" instead of implying
 * that nobody has scored.
 */
export interface LeagueScorers {
  available: boolean;
  seasonYear: number | null;
  scorers: TopScorer[];
}

/** Upstream budget/telemetry surfaced to the UI so quota state is visible. */
export interface ApiMeta {
  plan: string | null;
  requestsUsed: number | null;
  requestsLimit: number | null;
  /** True when served from cache without touching upstream. */
  fromCache: boolean;
  /** True when the budget guard blocked an upstream call. */
  budgetBlocked: boolean;
  /** Age of the served data in seconds. */
  ageSeconds: number;
  /** Set when the request failed and stale/empty data was served. */
  error?: string;
}

export interface MatchesPayload {
  date: string;
  matches: Match[];
  meta: ApiMeta;
  /**
   * Server time when these matches were normalized. The client seeds its local
   * clock from this so the derived live minute is consistent with the payload
   * and the first client render can't mismatch the server's HTML.
   */
  nowUnix: number;
}

