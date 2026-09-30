package co.jdwal.football.domain

/** What the UI renders. Nothing here is nullable that the UI must branch on. */
enum class MatchStatus { SCHEDULED, LIVE, FINISHED, POSTPONED, CANCELLED, UNKNOWN }

data class TeamRef(
    val id: Int,
    val name: String,
    val logo: String?,
)

data class LeagueRef(
    val id: Int,
    val name: String,
    val country: String?,
    val logo: String?,
    /** The phase: a knockout round, a group, or a matchday. May be null. */
    val round: String?,
)

data class Score(
    val home: Int?,
    val away: Int?,
    val halftimeHome: Int?,
    val halftimeAway: Int?,
)

enum class EventKind {
    GOAL, OWN_GOAL, PENALTY_GOAL, YELLOW, RED, SECOND_YELLOW, MISSED_PENALTY, DISALLOWED
}

data class MatchEvent(
    /** As the source renders it: "23" or "90+2". */
    val minute: String,
    val player: String,
    val assist: String?,
    /**
     * The team of the PLAYER — which for an own goal is the team it was scored
     * against. The screen decides which side to draw it on; see `scoringSide`.
     */
    val playerOnHome: Boolean,
    val kind: EventKind,
) {
    /**
     * The side the event counts FOR.
     *
     * An own goal belongs in the beneficiary's column, because that is where a
     * reader looks for it and how the scoreline adds up — while the label still
     * names the scorer's own club, so the row cannot read as though they play for
     * the team that benefited.
     */
    val scoringSideHome: Boolean
        get() = if (kind == EventKind.OWN_GOAL) !playerOnHome else playerOnHome
}

data class Match(
    val id: Int,
    val kickoffUnix: Long,
    val status: MatchStatus,
    /** Elapsed minute, live only. Never derived from kickoff — see Status.kt. */
    val minute: Int?,
    val isHalfTime: Boolean,
    val league: LeagueRef,
    val home: TeamRef,
    val away: TeamRef,
    val score: Score,
    val venue: String?,
    val referee: String?,
    val channels: List<String>,
    val events: List<MatchEvent>?,
) {
    val isLive: Boolean get() = status == MatchStatus.LIVE
}

data class LeagueGroup(
    val league: LeagueRef,
    val popularityRank: Int,
    val matches: List<Match>,
) {
    val isPopular: Boolean get() = popularityRank < Int.MAX_VALUE
}

data class StandingRow(
    val position: Int,
    val team: TeamRef,
    val group: String?,
    val played: Int?,
    val wins: Int?,
    val draws: Int?,
    val losses: Int?,
    val goalsFor: Int?,
    val goalsAgainst: Int?,
    val goalDifference: Int?,
    val points: Int?,
)

data class TopScorer(
    val rank: Int,
    val player: String,
    val photo: String?,
    val teamName: String?,
    val teamLogo: String?,
    val goals: Int?,
    val assists: Int?,
    val penalties: Int?,
    val appearances: Int?,
)
