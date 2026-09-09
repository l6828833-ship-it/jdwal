/**
 * App configuration: league priority, polling cadence, request budget.
 */

/**
 * Public site URL, used for SEO canonical links, Open Graph and the sitemap.
 *
 * Defaults to the production domain jdwal.co. Override with
 * `NEXT_PUBLIC_SITE_URL` only if the domain ever changes.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://jdwal.co"
).replace(/\/$/, "");

export interface PopularLeague {
  /** Stable internal key. */
  key: string;
  /** Arabic display name. */
  ar: string;
  /**
   * Known provider league ids (fastest, most reliable match). Includes ids from
   * every provider, since "Premier League" collides across countries and only
   * the id disambiguates England's from Egypt's. Each backend numbers the same
   * competition differently, so all of them are listed here.
   */
  ids: number[];
  /** Highlightly's id specifically, used to build its leagues/standings links. */
  highlightlyId: number;
  /** API-Football's id, used by the self-hosted backend. */
  apiFootballId: number;
  /**
   * Lowercased name fragments, used only as a fallback when the id is unknown.
   * Kept deliberately specific ("uefa champions league", not "premier league")
   * because bare names collide across countries.
   */
  aliases: string[];
}

/**
 * Most-watched leagues, highest priority first. Everything not listed here is
 * sorted alphabetically below the pinned block.
 *
 * Reorder or extend this array to change the home page ordering — nothing else
 * needs to change. Ids for leagues outside the current plan are filled in as
 * they become available; alias matching covers them in the meantime.
 *
 * Note: the free Footballdata.io plan only returns Premier League, UEFA
 * Champions League, UEFA Europa League, La Liga and World Cup. The rest stay
 * here so the ordering is already correct once the plan is upgraded.
 */
/**
 * FIXED display order, top to bottom:
 *
 *   1. Top European competitions — the five big leagues plus the Champions
 *      League (the "top 6" people watch most)
 *   2. Saudi Pro League
 *   3. Other Arab leagues (Egypt, UAE, Qatar, Iraq, Morocco, Tunisia, Algeria,
 *      Jordan)
 *   4. Everything else, alphabetically, below this pinned block
 *
 * This order is DELIBERATELY static. It is the array index, nothing else — it
 * does NOT change with the day, with which matches are live, or with any
 * "big event" weighting. Reorder this array to change the ordering; nothing
 * else needs to change.
 *
 * `ids` lists the competition's id on every backend, since they number the same
 * competition differently. Arab-league ids beyond Saudi are API-Football's; they
 * do not appear in the BBC scrape catalogue, but the entry still fixes their
 * name and rank for any source that does carry them.
 */
export const POPULAR_LEAGUES: PopularLeague[] = [
  // --- 0. Major international tournament (shown only while it runs) --------
  {
    key: "world-cup",
    ar: "كأس العالم",
    ids: [1],
    highlightlyId: 0,
    apiFootballId: 1,
    aliases: ["fifa world cup", "world cup"],
  },

  // --- 1. European: the cups first, then the big five leagues -------------
  {
    key: "ucl",
    ar: "دوري أبطال أوروبا",
    ids: [45, 2486, 2],
    highlightlyId: 2486,
    apiFootballId: 2,
    aliases: ["uefa champions league"],
  },
  {
    key: "uel",
    ar: "الدوري الأوروبي",
    ids: [46, 3337, 3],
    highlightlyId: 3337,
    apiFootballId: 3,
    aliases: ["uefa europa league"],
  },
  {
    key: "uecl",
    ar: "دوري المؤتمر الأوروبي",
    ids: [848],
    highlightlyId: 0,
    apiFootballId: 848,
    aliases: ["uefa europa conference league", "uefa conference league"],
  },
  {
    key: "premier-league",
    ar: "الدوري الإنجليزي الممتاز",
    ids: [15, 33973, 39],
    highlightlyId: 33973,
    apiFootballId: 39,
    aliases: ["english premier league"],
  },
  {
    key: "la-liga",
    ar: "الدوري الإسباني",
    ids: [10, 119924, 140],
    highlightlyId: 119924,
    apiFootballId: 140,
    aliases: ["laliga"],
  },
  {
    key: "serie-a",
    ar: "الدوري الإيطالي",
    ids: [115669, 135],
    highlightlyId: 115669,
    apiFootballId: 135,
    /**
     * Deliberately NOT a bare "serie a": alias matching is a substring test, so
     * "serie a" would also claim "Brazilian Serie A". Italy's bare "Serie A" is
     * matched by id 135, so the qualifier costs nothing.
     */
    aliases: ["italian serie a"],
  },
  {
    key: "bundesliga",
    ar: "الدوري الألماني",
    ids: [67162, 78],
    highlightlyId: 67162,
    apiFootballId: 78,
    aliases: [],
  },
  {
    key: "ligue-1",
    ar: "الدوري الفرنسي",
    ids: [52695, 61],
    highlightlyId: 52695,
    apiFootballId: 61,
    aliases: ["ligue 1"],
  },

  // --- 2. Arab: Saudi first, then the rest --------------------------------
  {
    key: "saudi-pro-league",
    ar: "دوري روشن السعودي",
    ids: [262041, 307],
    highlightlyId: 262041,
    apiFootballId: 307,
    aliases: ["saudi pro league", "saudi professional league"],
  },
  {
    key: "egypt",
    ar: "الدوري المصري",
    ids: [233],
    highlightlyId: 0,
    apiFootballId: 233,
    aliases: ["egyptian premier league"],
  },
  {
    key: "morocco",
    ar: "الدوري المغربي",
    ids: [200],
    highlightlyId: 0,
    apiFootballId: 200,
    aliases: ["botola pro", "moroccan"],
  },
  {
    key: "uae",
    ar: "دوري المحترفين الإماراتي",
    ids: [301],
    highlightlyId: 0,
    apiFootballId: 301,
    aliases: ["uae pro league", "uae league"],
  },
  {
    key: "qatar",
    ar: "دوري نجوم قطر",
    ids: [305],
    highlightlyId: 0,
    apiFootballId: 305,
    aliases: ["qatar stars league"],
  },
  {
    key: "iraq",
    ar: "دوري نجوم العراق",
    ids: [542],
    highlightlyId: 0,
    apiFootballId: 542,
    aliases: ["iraq stars league", "iraqi stars league"],
  },
  {
    key: "tunisia",
    ar: "الدوري التونسي",
    ids: [202],
    highlightlyId: 0,
    apiFootballId: 202,
    aliases: ["tunisian ligue professionnelle"],
  },
  {
    key: "algeria",
    ar: "الدوري الجزائري",
    ids: [186],
    highlightlyId: 0,
    apiFootballId: 186,
    aliases: ["algerian ligue professionnelle"],
  },
  {
    key: "jordan",
    ar: "الدوري الأردني",
    ids: [387],
    highlightlyId: 0,
    apiFootballId: 387,
    aliases: ["jordanian pro league"],
  },
  {
    key: "afcon",
    ar: "كأس الأمم الأفريقية",
    ids: [6],
    highlightlyId: 0,
    apiFootballId: 6,
    aliases: ["africa cup of nations", "afcon"],
  },

  // --- 3. A widely-followed extra, above the long alphabetical tail -------
  {
    key: "mls",
    ar: "الدوري الأمريكي",
    ids: [216087, 253],
    highlightlyId: 216087,
    apiFootballId: 253,
    aliases: ["major league soccer"],
  },
];

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Competitions that run qualifying rounds before a league or group phase.
 *
 * For these, Footballdata.io's `/leagues/{id}/standings` is unusable: it returns
 * ONE flat table that merges qualifying-round records with the league phase. In
 * the 2026/27 Champions League that means 81 rows — Sabah on 18 points from
 * qualifying sitting above Real Madrid on 0 — and for clubs that came through
 * qualifying, the two phases are summed into a single row that cannot be
 * separated afterwards. The endpoint accepts no round/stage/game_week filter
 * (all are silently ignored), and `/seasons/{id}/standings` returns empty rows.
 *
 * So for these competitions the table is computed from league-phase fixtures
 * instead. Qualifying rounds carry `game_week: null`; the league phase carries a
 * matchday number, which is the discriminator used.
 */
const MULTI_PHASE_LEAGUE_IDS = new Set([
  45, // UEFA Champions League
  46, // UEFA Europa League
  50, // World Cup
]);

const MULTI_PHASE_NAME_PATTERN =
  /champions league|europa league|conference league|world cup|nations league|copa libertadores/i;

/** True when the table must be derived from fixtures rather than the API's. */
export function hasQualifyingPhase(leagueId: number, leagueName: string): boolean {
  if (MULTI_PHASE_LEAGUE_IDS.has(leagueId)) return true;
  return MULTI_PHASE_NAME_PATTERN.test(leagueName);
}

/**
 * Popularity rank for a league. Lower sorts first; Infinity means unpinned.
 * Matches on id first, then on the longest alias contained in the name so that
 * "Europe UEFA Champions League" still resolves correctly.
 */
/**
 * Competitions that must NOT inherit a pinned rank by name alone.
 *
 * Alias matching is a substring test, so "U20 World Cup", "Women's World Cup",
 * "Club World Cup" and "World Cup Qualifications" all contain "world cup" and
 * were being pinned to the World Cup's top slot — pushing the real fixtures
 * down. A youth, women's, reserve or qualifying edition is a different
 * competition, so these fall through to the alphabetical tail instead.
 *
 * Note this only blocks ALIAS matching. An explicit id in `ids` still wins, so
 * a competition can always be pinned deliberately.
 */
const YOUTH_OR_SECONDARY = new RegExp(
  [
    "\\bu-?\\d{2}\\b", //        U17, U20, U-23, U21 ...
    "\\byouth\\b",
    "\\bjunior\\b",
    "\\bwomen", //               women / women's
    "\\bfeminine\\b",
    "\\bladies\\b",
    "\\bgirls\\b",
    "\\bboys\\b",
    "\\bclub world cup\\b", //   a different tournament from the World Cup
    "\\bqualif", //              qualification / qualifiers
    "\\bplayoff tournament\\b",
    "\\bfriendl", //             friendlies
    "\\breserve",
    "\\bacademy\\b",
    "\\bamateur\\b",
    "\\bfutsal\\b",
    "\\bbeach\\b",
    "\\besports\\b",
  ].join("|"),
  "i",
);

export function leaguePopularity(
  leagueId: number,
  leagueName: string,
): { rank: number; entry: PopularLeague | null } {
  const name = normalize(leagueName);

  for (let i = 0; i < POPULAR_LEAGUES.length; i++) {
    if (POPULAR_LEAGUES[i].ids.includes(leagueId)) {
      return { rank: i, entry: POPULAR_LEAGUES[i] };
    }
  }

  // A youth / women's / qualifying edition must not borrow a senior
  // competition's rank through a substring alias match.
  if (YOUTH_OR_SECONDARY.test(name)) {
    return { rank: Number.POSITIVE_INFINITY, entry: null };
  }

  let best: { rank: number; entry: PopularLeague; length: number } | null = null;
  for (let i = 0; i < POPULAR_LEAGUES.length; i++) {
    for (const alias of POPULAR_LEAGUES[i].aliases) {
      if (name.includes(alias)) {
        if (!best || alias.length > best.length) {
          best = { rank: i, entry: POPULAR_LEAGUES[i], length: alias.length };
        }
      }
    }
  }

  if (best) return { rank: best.rank, entry: best.entry };
  return { rank: Number.POSITIVE_INFINITY, entry: null };
}

/** Live polling interval, shared by the server cache TTL and the client. */
export const LIVE_POLL_SECONDS = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_LIVE_POLL_SECONDS);
  // Default 90s: on a 100/day free tier, 60s can drain the budget inside a
  // single two-hour match window. Lower it once on a paid tier.
  if (!Number.isFinite(raw) || raw <= 0) return 90;
  return Math.max(15, Math.round(raw));
})();

/**
 * Cache lifetimes in seconds, tuned against a 1000 request/month budget.
 *
 * Every visitor shares one server-side cache entry, so these TTLs bound total
 * upstream traffic regardless of how many browsers are polling.
 */
export const CACHE_TTL = {
  /** Live fixtures: matches the poll cadence. */
  live: LIVE_POLL_SECONDS,
  /**
   * Today's fixture list. 30 min: the list of who plays and when barely changes
   * intraday, and live scores refresh separately via polling, so the full day
   * list does not need frequent re-fetching. Big saving on a tight daily quota.
   */
  today: 30 * 60,
  /** Past dates are settled results. */
  past: 24 * 60 * 60,
  /** Future dates change rarely (kickoff time edits). */
  future: 6 * 60 * 60,
  /** A single match's detail page. */
  matchDetail: 2 * 60,
  /** Live match detail follows the poll cadence. */
  matchDetailLive: LIVE_POLL_SECONDS,
  /** League list for the plan. */
  leagues: 7 * 24 * 60 * 60,
  /** Team rosters, used to resolve team -> country for flags. */
  leagueTeams: 30 * 24 * 60 * 60,
  /** Team profile + fixtures. */
  team: 30 * 60,
  /** League table: only moves when matches finish. */
  standings: 30 * 60,
} as const;

/** Monthly upstream ceiling. The guard reserves headroom below this. */
export const MONTHLY_LIMIT = (() => {
  const raw = Number(process.env.FOOTBALLDATA_MONTHLY_LIMIT);
  if (!Number.isFinite(raw) || raw <= 0) return 1000;
  return Math.round(raw);
})();

/**
 * Budget guard thresholds, as a fraction of the request quota.
 *
 * Priority model (see lib/cache.ts):
 *   - "background" = automated live polling. First to be cut, because a left-
 *     open tab must never consume the whole budget and lock a user out.
 *   - "high" = a request the user is actively waiting on (opening the app,
 *     a match, a table). Allowed until the hard ceiling.
 *
 * So background polling stops at the soft limit, leaving the top slice of the
 * quota reserved for real interaction.
 */
export const BUDGET_SOFT_LIMIT_RATIO = 0.8;
/** Above this, no upstream calls at all; cached/stale data only. */
export const BUDGET_HARD_LIMIT_RATIO = 0.97;

/** Timezone used for "today", date grouping and kickoff display. */
export const DISPLAY_TIMEZONE =
  process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE || "Asia/Riyadh";

/** How many days back/forward the date arrows may travel. */
export const DATE_RANGE_DAYS = 14;

/**
 * Display caps for the league browse surfaces.
 *
 * The hosted providers returned 5 to 9 competitions, so listing all of them was
 * free. API-Football covers roughly 1200, and both surfaces sort pinned popular
 * leagues first — so a cap keeps the pages fast while still showing everything
 * anyone is likely to look for. The full set is always available from the
 * provider; only rendering is limited.
 */
export const LEAGUE_LIST_LIMIT = 120;
/** A horizontally scrolling tab strip stops being usable long before this. */
export const TEAM_BROWSE_LEAGUE_LIMIT = 40;
