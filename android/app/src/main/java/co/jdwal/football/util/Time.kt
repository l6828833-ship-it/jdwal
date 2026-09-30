package co.jdwal.football.util

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Dates and clocks, all of them in the DEVICE's zone.
 *
 * The zone is the important part. A "day" of fixtures runs from midnight to
 * midnight where the reader is, and the backend buckets by whatever zone it is
 * told — so the zone used to build a date key here must be the same one sent with
 * the request, or the list and its heading describe different days.
 *
 * Weekday and month names come from the JDK's locale data rather than a table in
 * this file, so the app reads correctly in every language it is translated into
 * without a second list to keep in sync.
 */
object Time {

    fun zone(): ZoneId = ZoneId.systemDefault()

    /** IANA name, which is what the backend's `timezoneName` expects. */
    fun zoneName(): String = zone().id

    fun today(zone: ZoneId = zone()): LocalDate = LocalDate.now(zone)

    /** "2026-09-17" — the backend's date parameter format. */
    fun key(date: LocalDate): String = date.format(DateTimeFormatter.ISO_LOCAL_DATE)

    fun nowUnix(): Long = System.currentTimeMillis() / 1000

    /** Kickoff clock, "19:00", in the device's zone. */
    fun kickoff(unix: Long, zone: ZoneId = zone()): String =
        formatter("HH:mm").withZone(zone).format(Instant.ofEpochSecond(unix))

    /** "Thursday, 17 September" — or its Arabic equivalent — for the date strip. */
    fun dayLabel(date: LocalDate): String = formatter("EEEE, d MMMM").format(date)

    fun shortDay(date: LocalDate): String = formatter("d/M").format(date)

    /**
     * Season as its STARTING year: 2026 means 2026/27, rolling over in July.
     * A wrong year returns an empty table for every competition, so it is
     * derived rather than hard-coded.
     */
    fun currentSeason(zone: ZoneId = zone()): Int {
        val now = today(zone)
        return if (now.monthValue >= 7) now.year else now.year - 1
    }

    /**
     * Formatters are expensive to build and these are used per row, so they are
     * cached — but keyed by locale as well as pattern. Caching on the pattern
     * alone would keep serving the language that happened to be active when the
     * first fixture list was drawn, straight through a locale change.
     */
    private val cache = HashMap<Pair<String, Locale>, DateTimeFormatter>()

    private fun formatter(pattern: String): DateTimeFormatter {
        val locale = Lang.formattingLocale()
        return synchronized(cache) {
            cache.getOrPut(pattern to locale) {
                DateTimeFormatter.ofPattern(pattern, locale)
            }
        }
    }
}
