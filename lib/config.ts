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

/**
 * Google Analytics 4 measurement id.
 *
 * Overridable so a fork or a staging deployment can point at its own property —
 * or send nothing at all by setting the variable to an empty string, which turns
 * the tag off (see components/analytics.tsx).
 */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-VQHYWT8Y4J";

/** Public publisher contact shown on trust and policy pages. */
export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@jdwal.co";

/**
 * AdSense client id, assigned by Google after/while applying (`ca-pub-...`).
 * Empty by default: no ad script or ad request is emitted until a real id is
 * configured. See components/adsense.tsx and app/ads.txt/route.ts.
 */
export const ADSENSE_CLIENT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "";

/** Policy/content revision date, kept consistent across trust pages. */
export const POLICY_LAST_UPDATED_AR = "8 سبتمبر 2026";


export type ProviderName =
  | "selfhosted"
  | "highlightly"
  | "footballdata"
  | "rapidapi";

/**
 * Which backend is serving data. Re-exported from lib/provider.ts, which is the
 * documented entry point for everything else.
 *
 * It lives HERE, in the module with no imports of its own, because the league
 * tables below have to know it: a competition id only means something inside one
 * provider's numbering, so matching an id without knowing whose it is produces
 * confident nonsense. Putting it in provider.ts and importing that from here
 * would close a cycle (provider -> selfhosted -> i18n -> config).
 */
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

export interface PopularLeague {
  /**
   * Stable internal key. NOT the URL — `slug` is.
   *
   * Kept separate because lib/broadcast.ts keys its channel table on this value,
   * so it cannot be reworded for the sake of a nicer address.
   */
  key: string;
  /**
   * The competition's segment in its URL: `/league/premier-league`.
   *
   * A numeric id in a URL tells a reader and a search engine nothing. The words
   * in a URL are read by both — they show up in the result, in a shared link and
   * in anchor text — so a curated competition gets a name there instead of
   * `/league/39`.
   *
   * English rather than Arabic: both work, and Google decodes a percent-encoded
   * Arabic slug back to Arabic in results, but a raw `%D8%A7%D9%84...` URL is
   * hostile to copy, paste and debug. Once published a slug is permanent — the
   * numeric form redirects to it — so changing one later costs a redirect chain.
   */
  slug: string;
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
  // --- 0. Major international tournaments (shown only while they run) ------
  {
    key: "world-cup",
    slug: "world-cup",
    ar: "كأس العالم",
    ids: [1],
    highlightlyId: 0,
    apiFootballId: 1,
    aliases: ["fifa world cup", "world cup"],
  },

  // --- 1. European: the cups first, then the big five leagues -------------
  {
    key: "ucl",
    slug: "champions-league",
    ar: "دوري أبطال أوروبا",
    ids: [45, 2486, 2],
    highlightlyId: 2486,
    apiFootballId: 2,
    aliases: ["uefa champions league"],
  },
  {
    key: "uel",
    slug: "europa-league",
    ar: "الدوري الأوروبي",
    ids: [46, 3337, 3],
    highlightlyId: 3337,
    apiFootballId: 3,
    aliases: ["uefa europa league"],
  },
  {
    key: "uecl",
    slug: "conference-league",
    ar: "دوري المؤتمر الأوروبي",
    ids: [848],
    highlightlyId: 0,
    apiFootballId: 848,
    aliases: ["uefa europa conference league", "uefa conference league"],
  },

  // --- 1b. Asian and African club cups -------------------------------------
  //
  // Placed with the other continental club cups rather than below the European
  // leagues, which is both consistent with the ordering this file already
  // documents (cups first, then leagues) and right for the audience: these are
  // the competitions Saudi, Emirati, Qatari, Egyptian, Moroccan and Tunisian
  // clubs play in, so for an Arabic-language site they outrank a foreign
  // domestic league. They were absent entirely, which left them with no Arabic
  // name, no rank, and no place in the tabs or the sitemap.
  {
    key: "afc-champions-league",
    slug: "afc-champions-league",
    ar: "دوري أبطال آسيا",
    ids: [17],
    highlightlyId: 0,
    apiFootballId: 17,
    // The competition was renamed "AFC Champions League Elite" in 2024; both
    // spellings are matched so a rename upstream cannot unpin it. The alias is
    // only a fallback anyway — the id is what normally resolves it.
    aliases: [
      "afc champions league elite",
      "afc champions league",
      "asian champions league",
    ],
  },
  {
    key: "caf-champions-league",
    slug: "caf-champions-league",
    ar: "دوري أبطال أفريقيا",
    ids: [12],
    highlightlyId: 0,
    apiFootballId: 12,
    aliases: ["caf champions league", "african champions league"],
  },
  {
    key: "premier-league",
    slug: "premier-league",
    ar: "الدوري الإنجليزي الممتاز",
    ids: [15, 33973, 39],
    highlightlyId: 33973,
    apiFootballId: 39,
    aliases: ["english premier league"],
  },
  {
    key: "la-liga",
    slug: "la-liga",
    ar: "الدوري الإسباني",
    ids: [10, 119924, 140],
    highlightlyId: 119924,
    apiFootballId: 140,
    aliases: ["laliga"],
  },
  {
    key: "serie-a",
    slug: "serie-a",
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
    slug: "bundesliga",
    ar: "الدوري الألماني",
    ids: [67162, 78],
    highlightlyId: 67162,
    apiFootballId: 78,
    aliases: [],
  },
  {
    key: "ligue-1",
    slug: "ligue-1",
    ar: "الدوري الفرنسي",
    ids: [52695, 61],
    highlightlyId: 52695,
    apiFootballId: 61,
    aliases: ["ligue 1"],
  },

  // --- 2. Arab: Saudi first, then Gulf Cup, then the rest ----------------
  {
    key: "saudi-pro-league",
    slug: "saudi-pro-league",
    ar: "دوري روشن السعودي",
    ids: [262041, 307],
    highlightlyId: 262041,
    apiFootballId: 307,
    aliases: ["saudi pro league", "saudi professional league"],
  },
  /**
   * Gulf Cup — pinned here, after the Saudi Pro League and before the other
   * Arab country leagues. It is a Gulf national-team tournament (biennial,
   * ~2 weeks), so it belongs in the Arab section rather than above the European
   * competitions. `851557` is the active backend's stable id for it, verified
   * against the live competition page. Arabic aliases cover sources that number
   * it differently; "خليجي" matches "خليجي 26" and similar edition names.
   * Youth and women's editions cannot inherit this rank — `YOUTH_OR_SECONDARY`
   * rejects "للشباب", "شباب" and "الناشئين" before alias matching runs.
   */
  {
    key: "gulf-cup",
    slug: "gulf-cup",
    ar: "كأس الخليج",
    ids: [851557],
    highlightlyId: 0,
    apiFootballId: 851557,
    aliases: [
      "كأس الخليج",
      "خليجي",
      "arabian gulf cup",
      "gulf cup of nations",
      "gulf cup",
    ],
  },
  {
    key: "egypt",
    slug: "egyptian-premier-league",
    ar: "الدوري المصري",
    ids: [233],
    highlightlyId: 0,
    apiFootballId: 233,
    aliases: ["egyptian premier league"],
  },
  {
    key: "morocco",
    slug: "botola-pro",
    ar: "الدوري المغربي",
    ids: [200],
    highlightlyId: 0,
    apiFootballId: 200,
    aliases: ["botola pro", "moroccan"],
  },
  {
    key: "uae",
    slug: "uae-pro-league",
    ar: "دوري المحترفين الإماراتي",
    ids: [301],
    highlightlyId: 0,
    apiFootballId: 301,
    aliases: ["uae pro league", "uae league"],
  },
  {
    key: "qatar",
    slug: "qatar-stars-league",
    ar: "دوري نجوم قطر",
    ids: [305],
    highlightlyId: 0,
    apiFootballId: 305,
    aliases: ["qatar stars league"],
  },
  {
    key: "iraq",
    slug: "iraqi-premier-league",
    ar: "دوري نجوم العراق",
    ids: [542],
    highlightlyId: 0,
    apiFootballId: 542,
    aliases: ["iraq stars league", "iraqi stars league"],
  },
  {
    key: "tunisia",
    slug: "tunisian-ligue-1",
    ar: "الدوري التونسي",
    ids: [202],
    highlightlyId: 0,
    apiFootballId: 202,
    aliases: ["tunisian ligue professionnelle"],
  },
  {
    key: "algeria",
    slug: "algerian-ligue-1",
    ar: "الدوري الجزائري",
    ids: [186],
    highlightlyId: 0,
    apiFootballId: 186,
    aliases: ["algerian ligue professionnelle"],
  },
  {
    key: "jordan",
    slug: "jordanian-pro-league",
    ar: "الدوري الأردني",
    ids: [387],
    highlightlyId: 0,
    apiFootballId: 387,
    aliases: ["jordanian pro league"],
  },
  {
    key: "afcon",
    slug: "africa-cup-of-nations",
    ar: "كأس الأمم الأفريقية",
    ids: [6],
    highlightlyId: 0,
    apiFootballId: 6,
    aliases: ["africa cup of nations", "afcon"],
  },

  // --- 3. A widely-followed extra, above the long alphabetical tail -------
  {
    key: "mls",
    slug: "mls",
    ar: "الدوري الأمريكي",
    ids: [216087, 253],
    highlightlyId: 216087,
    apiFootballId: 253,
    aliases: ["major league soccer"],
  },

  // --- 5. Domestic cups ----------------------------------------------------
  //
  // These were missing entirely, which is why a Carabao Cup third round with
  // Manchester United, Liverpool, Arsenal and Chelsea all playing did not appear
  // under "الأهم" — the competition simply was not curated, so every tie in it
  // ranked below any pinned league.
  //
  // Appended rather than interleaved, deliberately. Position in this array is the
  // ranking, and it drives three things at once: the home page grouping, the
  // sitemap priority, and the scorers tab strip — which shows the top TWELVE
  // pinned competitions. Slotting cups among the leagues would have pushed real
  // leaderboards out of that strip in favour of cups that mostly have none. Here
  // they are curated and "important" without displacing anything.
  //
  // Leagues before cups within the block, and each country's cup next to its
  // league's region, so the order still reads as an editorial list.
  {
    key: "fa-cup",
    slug: "fa-cup",
    ar: "كأس الاتحاد الإنجليزي",
    ids: [45],
    highlightlyId: 0,
    apiFootballId: 45,
    aliases: ["fa cup"],
  },
  {
    key: "efl-cup",
    slug: "carabao-cup",
    ar: "كأس الكاراباو",
    ids: [48],
    highlightlyId: 0,
    // Renamed repeatedly by sponsor (League Cup, Capital One, Carabao), so the
    // aliases cover the lot — though the id is what normally resolves it.
    aliases: ["carabao cup", "efl cup", "league cup"],
    apiFootballId: 48,
  },
  {
    key: "copa-del-rey",
    slug: "copa-del-rey",
    ar: "كأس ملك إسبانيا",
    ids: [143],
    highlightlyId: 0,
    apiFootballId: 143,
    aliases: ["copa del rey"],
  },
  {
    key: "coppa-italia",
    slug: "coppa-italia",
    ar: "كأس إيطاليا",
    ids: [137],
    highlightlyId: 0,
    apiFootballId: 137,
    aliases: ["coppa italia"],
  },
  {
    key: "dfb-pokal",
    slug: "dfb-pokal",
    ar: "كأس ألمانيا",
    ids: [81],
    highlightlyId: 0,
    apiFootballId: 81,
    aliases: ["dfb pokal", "dfb-pokal"],
  },
  {
    key: "coupe-de-france",
    slug: "coupe-de-france",
    ar: "كأس فرنسا",
    ids: [66],
    highlightlyId: 0,
    apiFootballId: 66,
    aliases: ["coupe de france"],
  },
  /**
   * Arab domestic cups.
   *
   * On locally assigned ids in the 900000+ range, because API-Football publishes
   * its id list only inside its dashboard and guessing from a league's
   * neighbouring number silently maps a cup onto an unrelated competition. The
   * backend assigns them and documents the range — see `TO_API_FOOTBALL` in
   * utils/scores365/leagues.js. Nothing else in this file uses that range.
   */
  {
    key: "saudi-king-cup",
    slug: "saudi-king-cup",
    ar: "كأس الملك السعودي",
    ids: [900001],
    highlightlyId: 0,
    apiFootballId: 900001,
    aliases: ["king cup", "saudi king cup"],
  },
  {
    key: "egypt-cup",
    slug: "egypt-cup",
    ar: "كأس مصر",
    ids: [900002],
    highlightlyId: 0,
    apiFootballId: 900002,
    aliases: ["egypt cup", "egyptian cup"],
  },
  {
    key: "morocco-throne-cup",
    slug: "throne-cup",
    ar: "كأس العرش المغربي",
    ids: [900003],
    highlightlyId: 0,
    apiFootballId: 900003,
    aliases: ["throne cup", "coupe du trone"],
  },
  {
    key: "uae-president-cup",
    slug: "uae-presidents-cup",
    ar: "كأس رئيس الدولة الإماراتي",
    ids: [900004],
    highlightlyId: 0,
    apiFootballId: 900004,
    aliases: ["president cup", "presidents cup"],
  },
  {
    key: "qatar-emir-cup",
    slug: "qatar-emir-cup",
    ar: "كأس أمير قطر",
    ids: [900005],
    highlightlyId: 0,
    apiFootballId: 900005,
    aliases: ["emir cup"],
  },
  {
    key: "tunisia-cup",
    slug: "tunisia-cup",
    ar: "كأس تونس",
    ids: [900006],
    highlightlyId: 0,
    apiFootballId: 900006,
    aliases: ["coupe de tunisie", "tunisia cup"],
  },
  {
    key: "algeria-cup",
    slug: "algeria-cup",
    ar: "كأس الجزائر",
    ids: [900007],
    highlightlyId: 0,
    apiFootballId: 900007,
    aliases: ["coupe d'algerie", "algeria cup"],
  },
  {
    key: "jordan-cup",
    slug: "jordan-cup",
    ar: "كأس الأردن",
    ids: [900008],
    highlightlyId: 0,
    apiFootballId: 900008,
    aliases: ["jordan cup"],
  },
  {
    key: "iraq-cup",
    slug: "iraq-cup",
    ar: "كأس العراق",
    ids: [900009],
    highlightlyId: 0,
    apiFootballId: 900009,
    aliases: ["iraq cup"],
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
    /**
     * The same exclusions in Arabic.
     *
     * Every one above is an English word, and the active data source is asked for
     * Arabic — so none of them ever fired. That left alias matching free to hand a
     * women's or youth edition its senior competition's rank purely because the
     * senior name is a substring of it: "كأس مصر للسيدات" contains "كأس مصر".
     * Observed live, where a French women's league and an English U21 league were
     * ranked among the pinned competitions.
     *
     * No word boundaries: `\b` is defined on ASCII word characters and does not
     * behave meaningfully against Arabic script.
     */
    "للسيدات", //   women's
    "سيدات",
    "نساء",
    "للشباب", //    youth
    "شباب",
    "الناشئين", //  juniors
    "ناشئين",
    "أواسط", //     intermediate age group
    "رديف", //      reserves
    "الرصيف",
    "تحت\\s*\\d{2}", // تحت 21 / تحت 17
    "أولمبي", //    olympic (a different, age-limited team)
    "الصالات", //   futsal
    "الشاطئية", //  beach
  ].join("|"),
  "i",
);

/**
 * Does `leagueId` identify `entry` — in the numbering of the ACTIVE provider?
 *
 * `entry.ids` is a UNION across three backends, and that made it unsafe to match
 * against on its own: an id is only meaningful inside one provider's namespace,
 * and the namespaces collide. Concretely, 45 is Footballdata.io's id for the
 * Champions League AND API-Football's id for the FA Cup. Matching the union
 * meant that under the self-hosted backend (API-Football numbering) the FA Cup
 * was identified as the Champions League — it inherited its Arabic name and its
 * popularity rank, so /scorers showed two tabs both reading
 * "دوري أبطال أوروبا", one of which was the FA Cup.
 *
 * So each provider is matched only against ids that are actually its own:
 *
 *   selfhosted   `apiFootballId` — the backend normalizes everything to these
 *   highlightly  `highlightlyId`, when known; 0 means unmapped, and falling back
 *                to the union would reintroduce exactly the collision above
 *   others       the union, because Footballdata.io's ids are recorded nowhere
 *                else. Those providers are fallbacks, so this keeps their
 *                existing behaviour rather than guessing at ids to split out.
 *
 * A league that matches no id still resolves by NAME through the alias tables,
 * which is how competitions outside this list have always been handled.
 */
export function matchesLeagueId(entry: PopularLeague, leagueId: number): boolean {
  switch (activeProvider()) {
    case "selfhosted":
      // `0` means "no id asserted for this competition" (see the Gulf Cup entry),
      // so it must never match. Without this guard a backend competition arriving
      // as id 0 would inherit an unrelated entry's name and rank — the same class
      // of bug as the FA Cup/Champions League collision described above.
      return entry.apiFootballId > 0 && entry.apiFootballId === leagueId;
    case "highlightly":
      return entry.highlightlyId > 0 && entry.highlightlyId === leagueId;
    default:
      return entry.ids.includes(leagueId);
  }
}

/**
 * Is this one of the competitions this site actually curates?
 *
 * The backend serves ~800 competitions and mints a stable derived id (800000+)
 * for every one it does not have a real mapping for, so `/league/<id>` answers
 * for all of them. That turned into 127 indexed pages — `/league/829457`,
 * `/league/880444`, `/league/838570` and so on: third divisions, reserve and
 * youth sides, most named just "الدرجة الاولى" with no country to tell them
 * apart. Thin, near-identical pages in that volume are a quality problem for the
 * whole domain, not just dead weight.
 *
 * The pinned list is the answer to "which league pages are worth indexing", and
 * it is the same list the sitemap is built from, so the two cannot drift.
 */
/**
 * Competitions this site does not carry at all.
 *
 * Distinct from "not popular": an unpopular competition still appears, ranked
 * below the pinned ones. These are removed from the fixture lists and the
 * catalogue outright, because their presence made the app hard to read — a day
 * runs to ~550 fixtures worldwide, and the recognisable competitions were a small
 * minority buried among reserve, youth and fourth-tier games.
 *
 * Two categories, both judgements about the KIND of competition rather than its
 * country or size:
 *
 *   1. Not senior men's first-team football — women's, youth and age-group,
 *      reserves, futsal, beach, esports, friendlies. These arrive SHARING their
 *      parent competition's name, which is also how they used to inherit its
 *      popularity rank.
 *   2. Lower divisions — second tier and below.
 *
 * A pinned competition is never hidden, so a second tier that genuinely is
 * followed can be curated in POPULAR_LEAGUES and keeps showing.
 *
 * Deliberately NOT hidden: small-nation TOP divisions. They are real first-tier
 * football and someone from that country may be looking for exactly them, so they
 * stay — merely unranked, below everything curated. This is the one place that
 * decides, so tightening it later is a single edit.
 */
const NOT_CARRIED = new RegExp(
  [
    // --- not senior men's first-team football, English ---
    "\\bu-?\\d{2}\\b",
    "\\byouth\\b",
    "\\bjunior\\b",
    "\\bwomen",
    "\\bfeminine\\b",
    "\\bladies\\b",
    "\\bgirls\\b",
    "\\bboys\\b",
    "\\breserve",
    "\\bacademy\\b",
    "\\bamateur\\b",
    "\\bfutsal\\b",
    "\\bbeach\\b",
    "\\besports\\b",
    "\\bfriendl",
    // --- the same in Arabic. No `\b`: it is defined on ASCII word characters and
    // does not behave meaningfully against Arabic script.
    "للسيدات",
    "سيدات",
    "نساء",
    "للشباب",
    "الناشئين",
    "ناشئين",
    "أواسط",
    "رديف",
    "تحت\\s*\\d{2}",
    "أولمبي",
    "الصالات",
    "الشاطئية",
    "ودية",
    // --- lower divisions ---
    "\\bdivision\\s*[234]\\b",
    "\\b[234]\\.\\s*liga\\b",
    "\\bserie\\s*[cd]\\b",
    "\\bsegunda\\b",
    "\\bregionalliga\\b",
    "\\boberliga\\b",
    "\\bnational\\s*[23]\\b",
    "الدرجة الثانية",
    "الدرجة الثالثة",
    "الدرجة الرابعة",
  ].join("|"),
  "i",
);

/**
 * Should this competition appear anywhere in the app?
 *
 * A pinned competition always does — the curated list overrides the filter, so
 * anything hidden by accident is fixable by pinning it rather than by unpicking a
 * regex.
 */
export function isCarriedLeague(leagueId: number, leagueName: string): boolean {
  if (isPinnedLeague(leagueId)) return true;
  return !NOT_CARRIED.test(normalize(leagueName));
}

export function isPinnedLeague(leagueId: number): boolean {
  return POPULAR_LEAGUES.some((entry) => matchesLeagueId(entry, leagueId));
}

/** The curated competition behind an id, or null for everything else. */
export function pinnedLeague(leagueId: number): PopularLeague | null {
  return POPULAR_LEAGUES.find((entry) => matchesLeagueId(entry, leagueId)) ?? null;
}

/** `39` -> `"premier-league"`, or null when the competition is not curated. */
export function leagueSlug(leagueId: number): string | null {
  return pinnedLeague(leagueId)?.slug ?? null;
}

/**
 * `"premier-league"` -> `39`, or null when nothing claims that slug.
 *
 * Only the slug is accepted, not the internal `key`: two names for one URL is
 * how duplicate content starts.
 */
export function leagueIdFromSlug(slug: string): number | null {
  const wanted = slug.trim().toLowerCase();
  const entry = POPULAR_LEAGUES.find((league) => league.slug === wanted);
  // An entry with no asserted id (apiFootballId 0) has no competition page to
  // resolve to. Returning 0 here would render `/league/<slug>` against id 0 and
  // produce a permanently empty page on a real, linkable URL, so the slug is
  // reported as unclaimed instead and the route 404s. Such an entry is still
  // pinned for ranking and grouping, which works by name.
  if (!entry || entry.apiFootballId <= 0) return null;
  return entry.apiFootballId;
}

/**
 * The URL for a competition — the ONE place that decides its shape.
 *
 * Curated competitions get their slug; everything else keeps its numeric id,
 * because a competition with no entry here has no name to put in a URL. Every
 * link in the app goes through this, so the numeric form is never linked
 * internally for a competition that has a slug — otherwise every internal click
 * would take the redirect hop declared in next.config.ts.
 */
export function leagueHref(leagueId: number): string {
  return `/league/${leagueSlug(leagueId) ?? leagueId}`;
}

/**
 * Every `/league/<id>` -> `/league/<slug>` redirect, for next.config.ts.
 *
 * Generated from the table above rather than written out, so a new competition
 * cannot be added with a slug and no redirect. Both forms would otherwise stay
 * live and index separately.
 */
export function leagueSlugRedirects(): Array<{
  source: string;
  destination: string;
  permanent: true;
}> {
  return POPULAR_LEAGUES
    // Entries with no asserted id (apiFootballId 0) have no numeric URL to
    // redirect FROM, and `/league/0` is not a real competition page.
    .filter((league) => league.apiFootballId > 0)
    .map((league) => ({
      source: `/league/${league.apiFootballId}`,
      destination: `/league/${league.slug}`,
      permanent: true,
    }));
}

export function leaguePopularity(
  leagueId: number,
  leagueName: string,
): { rank: number; entry: PopularLeague | null } {
  const name = normalize(leagueName);

  for (let i = 0; i < POPULAR_LEAGUES.length; i++) {
    if (matchesLeagueId(POPULAR_LEAGUES[i], leagueId)) {
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

/**
 * Live polling interval, shared by the server cache TTL and the client.
 *
 * The DEFAULT is what production runs on: `NEXT_PUBLIC_*` is inlined at build
 * time, so a value set only in a local `.env.local` (which is gitignored, and
 * never reaches the deploy) does nothing there. The old 90s default was sized
 * for a 100-request/day free tier, which no longer describes the shipped
 * backend: the self-hosted provider has no request quota, and lib/cache.ts means
 * every browser polling shares ONE upstream fetch per interval regardless of how
 * many are connected. 90s just made the live minute update in coarse jumps.
 *
 * To change it in production, set NEXT_PUBLIC_LIVE_POLL_SECONDS at BUILD time.
 */
export const LIVE_POLL_SECONDS = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_LIVE_POLL_SECONDS);
  if (!Number.isFinite(raw) || raw <= 0) return 30;
  return Math.max(15, Math.round(raw));
})();

/**
 * `Cache-Control` for the live endpoints.
 *
 * `stale-while-revalidate` used to be four times the poll interval, which on the
 * 90s default let a CDN serve a payload up to 7.5 MINUTES old. That payload
 * carries the `nowUnix` from when it was built, so the client was pacing a live
 * match off a timestamp from several minutes ago. A short window still absorbs
 * repeat polls and shields the origin, without pretending stale scores are fine.
 */
export const LIVE_CACHE_CONTROL =
  `public, s-maxage=${LIVE_POLL_SECONDS}, stale-while-revalidate=${LIVE_POLL_SECONDS}`;

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
