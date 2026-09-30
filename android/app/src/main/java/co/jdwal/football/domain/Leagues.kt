package co.jdwal.football.domain

import co.jdwal.football.util.Lang

/**
 * Which competitions the app curates, in the order it ranks them.
 *
 * The same editorial list the website uses, and it does three jobs at once: the
 * order is the grouping order on the matches screen, the first entries are the
 * tabs on the scorers screen, and membership is what "important" means.
 *
 * Ids are the ones the backend exposes. The 900000+ block is not a mistake — see
 * the backend's league map: those are locally assigned ids for Arab cups whose
 * API-Football numbering is not published, and guessing a neighbouring number is
 * how a cup gets silently mapped onto an unrelated competition.
 *
 * Each entry carries BOTH names. The backend serves whatever language it is
 * configured for, so its competition name cannot be trusted to match the app's
 * language; naming the curated competitions here is what keeps the list of
 * headings in one language even when the feed is in the other.
 */
data class CuratedLeague(
    val id: Int,
    val nameEn: String,
    val nameAr: String,
    val slug: String,
) {
    /** The name in the reader's language. */
    val name: String get() = Lang.pick(nameEn, nameAr)
}

object Leagues {

    val CURATED: List<CuratedLeague> = listOf(
        CuratedLeague(1, "World Cup", "كأس العالم", "world-cup"),
        CuratedLeague(2, "Champions League", "دوري أبطال أوروبا", "champions-league"),
        CuratedLeague(3, "Europa League", "الدوري الأوروبي", "europa-league"),
        CuratedLeague(848, "Conference League", "دوري المؤتمر الأوروبي", "conference-league"),
        CuratedLeague(17, "AFC Champions League", "دوري أبطال آسيا", "afc-champions-league"),
        CuratedLeague(12, "CAF Champions League", "دوري أبطال أفريقيا", "caf-champions-league"),
        CuratedLeague(39, "Premier League", "الدوري الإنجليزي الممتاز", "premier-league"),
        CuratedLeague(140, "LaLiga", "الدوري الإسباني", "la-liga"),
        CuratedLeague(135, "Serie A", "الدوري الإيطالي", "serie-a"),
        CuratedLeague(78, "Bundesliga", "الدوري الألماني", "bundesliga"),
        CuratedLeague(61, "Ligue 1", "الدوري الفرنسي", "ligue-1"),
        CuratedLeague(307, "Saudi Pro League", "دوري روشن السعودي", "saudi-pro-league"),
        CuratedLeague(233, "Egyptian Premier League", "الدوري المصري", "egyptian-premier-league"),
        CuratedLeague(200, "Botola Pro", "الدوري المغربي", "botola-pro"),
        CuratedLeague(301, "UAE Pro League", "دوري المحترفين الإماراتي", "uae-pro-league"),
        CuratedLeague(305, "Qatar Stars League", "دوري نجوم قطر", "qatar-stars-league"),
        CuratedLeague(542, "Iraq Stars League", "دوري نجوم العراق", "iraqi-premier-league"),
        CuratedLeague(202, "Tunisian Ligue 1", "الدوري التونسي", "tunisian-ligue-1"),
        CuratedLeague(186, "Algerian Ligue 1", "الدوري الجزائري", "algerian-ligue-1"),
        CuratedLeague(387, "Jordan Pro League", "الدوري الأردني", "jordanian-pro-league"),
        CuratedLeague(6, "Africa Cup of Nations", "كأس الأمم الأفريقية", "africa-cup-of-nations"),
        CuratedLeague(253, "MLS", "الدوري الأمريكي", "mls"),
        // Domestic cups, after the leagues.
        CuratedLeague(45, "FA Cup", "كأس الاتحاد الإنجليزي", "fa-cup"),
        CuratedLeague(48, "Carabao Cup", "كأس الكاراباو", "carabao-cup"),
        CuratedLeague(143, "Copa del Rey", "كأس ملك إسبانيا", "copa-del-rey"),
        CuratedLeague(137, "Coppa Italia", "كأس إيطاليا", "coppa-italia"),
        CuratedLeague(81, "DFB-Pokal", "كأس ألمانيا", "dfb-pokal"),
        CuratedLeague(66, "Coupe de France", "كأس فرنسا", "coupe-de-france"),
        CuratedLeague(900001, "Saudi King Cup", "كأس الملك السعودي", "saudi-king-cup"),
        CuratedLeague(900002, "Egypt Cup", "كأس مصر", "egypt-cup"),
        CuratedLeague(900003, "Throne Cup", "كأس العرش المغربي", "throne-cup"),
        CuratedLeague(900004, "UAE President's Cup", "كأس رئيس الدولة الإماراتي", "uae-presidents-cup"),
        CuratedLeague(900005, "Qatar Emir Cup", "كأس أمير قطر", "qatar-emir-cup"),
        CuratedLeague(900006, "Tunisia Cup", "كأس تونس", "tunisia-cup"),
        CuratedLeague(900007, "Algeria Cup", "كأس الجزائر", "algeria-cup"),
        CuratedLeague(900008, "Jordan Cup", "كأس الأردن", "jordan-cup"),
        CuratedLeague(900009, "Iraq Cup", "كأس العراق", "iraq-cup"),
    )

    private val byId: Map<Int, Int> =
        CURATED.withIndex().associate { (index, league) -> league.id to index }

    /** Editorial rank; `Int.MAX_VALUE` for anything not curated. */
    fun rank(leagueId: Int): Int = byId[leagueId] ?: Int.MAX_VALUE

    fun isCurated(leagueId: Int): Boolean = byId.containsKey(leagueId)

    /** The curated name, which beats the feed's stage-suffixed one. */
    fun curatedName(leagueId: Int): String? =
        byId[leagueId]?.let { CURATED[it].name }

    /**
     * Competitions the app does not carry at all.
     *
     * Distinct from "not curated": an uncurated competition still shows, ranked
     * last. These are dropped, because a day's worldwide feed runs to ~550
     * fixtures and the recognisable ones were a minority buried among reserve,
     * youth and fourth-tier games.
     *
     * Both languages, and no `\b` around the Arabic: a word boundary is defined
     * on ASCII word characters and never matches next to Arabic script. Which
     * language the feed answers in is a backend setting, so both sets of patterns
     * stay regardless of the app's own language.
     */
    private val NOT_CARRIED = Regex(
        listOf(
            // not senior men's first-team football
            "\\bu-?\\d{2}\\b", "\\byouth\\b", "\\bjunior\\b", "\\bwomen",
            "\\bfeminine\\b", "\\bladies\\b", "\\bgirls\\b", "\\bboys\\b",
            "\\breserve", "\\bacademy\\b", "\\bamateur\\b", "\\bfutsal\\b",
            "\\bbeach\\b", "\\besports\\b", "\\bfriendl",
            "للسيدات", "سيدات", "نساء", "للشباب", "الناشئين", "ناشئين",
            "أواسط", "رديف", "تحت\\s*\\d{2}", "أولمبي", "الصالات", "الشاطئية",
            "ودية",
            // lower divisions
            "\\bdivision\\s*[234]\\b", "\\b[234]\\.\\s*liga\\b",
            "\\bserie\\s*[cd]\\b", "\\bsegunda\\b", "\\bregionalliga\\b",
            "\\boberliga\\b", "\\bnational\\s*[23]\\b",
            "الدرجة الثانية", "الدرجة الثالثة", "الدرجة الرابعة",
        ).joinToString("|"),
        RegexOption.IGNORE_CASE,
    )

    /**
     * A curated competition is never hidden, so anything caught by accident is
     * fixed by curating it rather than by unpicking the pattern above.
     */
    fun isCarried(leagueId: Int, leagueName: String): Boolean =
        isCurated(leagueId) || !NOT_CARRIED.containsMatchIn(leagueName)

    /** Groups a day's fixtures: curated competitions first, then alphabetical. */
    fun group(matches: List<Match>): List<LeagueGroup> = matches
        .filter { isCarried(it.league.id, it.league.name) }
        .groupBy { it.league.id }
        .map { (_, group) ->
            LeagueGroup(
                league = group.first().league,
                popularityRank = rank(group.first().league.id),
                matches = group.sortedWith(
                    compareBy({ it.kickoffUnix }, { it.home.name }),
                ),
            )
        }
        .sortedWith(compareBy({ it.popularityRank }, { it.league.name }))
}
