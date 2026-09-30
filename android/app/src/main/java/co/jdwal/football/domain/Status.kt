package co.jdwal.football.domain

/**
 * Status and match clock.
 *
 * The source's status codes are trusted verbatim and the minute is never derived
 * from kickoff time. A guessed clock gets a late kickoff or any stoppage wrong,
 * and showing a fabricated minute on a match that has not started is worse than
 * showing none.
 */
object Status {

    /** Past this many minutes after kickoff, no match is still being played. */
    const val MAX_MATCH_WINDOW_MINUTES = 210

    /**
     *   NS/TBD  not started          1H/2H/HT/ET/BT/P/LIVE  in play
     *   FT/AET/PEN/AWD/WO  finished  PST  postponed
     *   CANC/ABD  cancelled          INT/SUSP  interrupted, still live
     */
    fun fromShort(short: String?): MatchStatus = when (short?.uppercase()) {
        "NS", "TBD" -> MatchStatus.SCHEDULED
        "1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT", "SUSP" -> MatchStatus.LIVE
        "FT", "AET", "PEN", "AWD", "WO" -> MatchStatus.FINISHED
        "PST" -> MatchStatus.POSTPONED
        "CANC", "ABD" -> MatchStatus.CANCELLED
        else -> MatchStatus.UNKNOWN
    }

    /**
     * Correct a status the feed has left stuck on "live".
     *
     * Some feeds freeze a finished match on its last live minute instead of
     * flipping it to full time, leaving it at "97'" with a running clock forever.
     * Past the window above, a match the source still calls live has certainly
     * ended. The score in the feed is already final, so this only ever corrects
     * the status and the minute — never a result.
     */
    fun settle(status: MatchStatus, kickoffUnix: Long, nowUnix: Long): MatchStatus {
        if (status != MatchStatus.LIVE || kickoffUnix <= 0) return status
        val minutesSince = (nowUnix - kickoffUnix) / 60
        return if (minutesSince > MAX_MATCH_WINDOW_MINUTES) MatchStatus.FINISHED else status
    }

    /**
     * The minute to show while a match is in play, advanced locally between
     * polls so the clock keeps ticking without extra requests.
     *
     * Clamped, and never shown at half time — a frozen "45" next to "Half time"
     * reads as a stalled clock.
     */
    fun displayMinute(
        status: MatchStatus,
        reportedMinute: Int?,
        reportedAtUnix: Long,
        nowUnix: Long,
    ): Int? {
        if (status != MatchStatus.LIVE || reportedMinute == null) return null
        val elapsedSincePoll = ((nowUnix - reportedAtUnix) / 60).coerceAtLeast(0)
        return (reportedMinute + elapsedSincePoll).coerceAtMost(130).toInt()
    }
}
