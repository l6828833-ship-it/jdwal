package co.jdwal.football.data

import co.jdwal.football.domain.LeagueGroup
import co.jdwal.football.domain.Leagues
import co.jdwal.football.domain.Match
import co.jdwal.football.domain.StandingRow
import co.jdwal.football.domain.TopScorer
import co.jdwal.football.util.Time
import java.time.LocalDate

/**
 * The app's single data entry point.
 *
 * Holds a short in-memory cache because the matches screen polls while a match is
 * live and the user flicks between days: without it, every return to today is a
 * fresh round trip on mobile data. Nothing is persisted to disk — scores are
 * worth less the older they are, and a stale table shown as current is worse than
 * a spinner.
 */
class Repository(private val api: Api = Api()) {

    private data class Entry<T>(val value: T, val atUnix: Long)

    private val days = mutableMapOf<String, Entry<List<Match>>>()
    private val standings = mutableMapOf<Int, Entry<Pair<String?, List<StandingRow>>>>()
    private val scorers = mutableMapOf<Int, Entry<List<TopScorer>>>()

    /**
     * A day that can still hold a live match is refetched every poll interval;
     * a settled day is not. Proximity to today, not string equality, because a
     * match kicking off at 23:00 is still being played after midnight.
     */
    private fun ttlFor(date: LocalDate): Long =
        if (kotlin.math.abs(date.toEpochDay() - Time.today().toEpochDay()) <= 1) 30 else 900

    suspend fun matches(date: LocalDate, force: Boolean = false): List<Match> {
        val key = Time.key(date)
        val now = Time.nowUnix()
        val cached = days[key]
        if (!force && cached != null && now - cached.atUnix < ttlFor(date)) {
            return cached.value
        }

        val dto = api.matchesOn(key, Time.zoneName())
        val mapped = dto.mapNotNull { Mapper.match(it, now) }
        days[key] = Entry(mapped, now)
        return mapped
    }

    /** Grouped for display: carried competitions only, curated ones first. */
    suspend fun dayGroups(date: LocalDate, force: Boolean = false): List<LeagueGroup> =
        Leagues.group(matches(date, force))

    suspend fun match(matchId: Int): Match? =
        api.match(matchId, Time.zoneName())?.let { Mapper.match(it, Time.nowUnix()) }

    /** Returns the competition's name alongside its table. */
    suspend fun standings(leagueId: Int, force: Boolean = false): Pair<String?, List<StandingRow>> {
        val now = Time.nowUnix()
        val cached = standings[leagueId]
        if (!force && cached != null && now - cached.atUnix < 900) return cached.value

        val dto = api.standings(leagueId, Time.currentSeason(), Time.zoneName())
        val name = Leagues.curatedName(leagueId) ?: dto?.league?.name?.trim()
        val rows = dto?.let { Mapper.standings(it) } ?: emptyList()
        val value = name to rows
        standings[leagueId] = Entry(value, now)
        return value
    }

    suspend fun leagueFixtures(leagueId: Int): List<Match> {
        val now = Time.nowUnix()
        val dto = api.leagueFixtures(leagueId, Time.zoneName()) ?: return emptyList()
        return dto.fixtures.orEmpty()
            .mapNotNull { Mapper.match(it, now) }
            .sortedBy { it.kickoffUnix }
    }

    suspend fun scorers(leagueId: Int, force: Boolean = false): List<TopScorer> {
        val now = Time.nowUnix()
        val cached = scorers[leagueId]
        if (!force && cached != null && now - cached.atUnix < 900) return cached.value

        val value = Mapper.scorers(api.topScorers(leagueId, Time.currentSeason()))
        scorers[leagueId] = Entry(value, now)
        return value
    }
}
