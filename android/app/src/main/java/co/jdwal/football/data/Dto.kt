package co.jdwal.football.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * The backend's wire format, which mirrors API-Football's shape.
 *
 * Every field is nullable with a default. That is not defensiveness for its own
 * sake: this feed omits whole objects depending on the endpoint — the fixtures
 * LIST carries no events or statistics, only the single-fixture route does — and
 * `ignoreUnknownKeys` plus defaults means a new field upstream cannot crash the
 * app. The names the source returns are already Arabic, so nothing here needs
 * translating.
 */
@Serializable
data class TeamDto(
    val id: Int? = null,
    val name: String? = null,
    val logo: String? = null,
)

@Serializable
data class LeagueDto(
    val id: Int? = null,
    val name: String? = null,
    val country: String? = null,
    val logo: String? = null,
    val round: String? = null,
    val season: Int? = null,
    val type: String? = null,
)

@Serializable
data class StatusDto(
    val long: String? = null,
    val short: String? = null,
    val elapsed: Int? = null,
)

@Serializable
data class VenueDto(
    val name: String? = null,
    val city: String? = null,
)

@Serializable
data class FixtureCoreDto(
    val id: Int? = null,
    val referee: String? = null,
    val date: String? = null,
    val timestamp: Long? = null,
    val venue: VenueDto? = null,
    val status: StatusDto? = null,
    @SerialName("tv_channels") val tvChannels: List<String>? = null,
)

@Serializable
data class GoalsDto(val home: Int? = null, val away: Int? = null)

@Serializable
data class ScoreDto(
    val halftime: GoalsDto? = null,
    val fulltime: GoalsDto? = null,
    val extratime: GoalsDto? = null,
    val penalty: GoalsDto? = null,
)

@Serializable
data class EventTimeDto(val elapsed: Int? = null, val extra: Int? = null)

@Serializable
data class EventPlayerDto(val id: Int? = null, val name: String? = null)

@Serializable
data class EventDto(
    val time: EventTimeDto? = null,
    val team: TeamDto? = null,
    val player: EventPlayerDto? = null,
    val assist: EventPlayerDto? = null,
    val type: String? = null,
    val detail: String? = null,
)

@Serializable
data class TeamsDto(val home: TeamDto? = null, val away: TeamDto? = null)

@Serializable
data class FixtureDto(
    val fixture: FixtureCoreDto? = null,
    val league: LeagueDto? = null,
    val teams: TeamsDto? = null,
    val goals: GoalsDto? = null,
    val score: ScoreDto? = null,
    val events: List<EventDto>? = null,
)

/** `/fixtures/getLeagueFixtures` wraps the list with the competition. */
@Serializable
data class LeagueFixturesDto(
    val league: LeagueDto? = null,
    val fixtures: List<FixtureDto>? = null,
)

// --- Standings -------------------------------------------------------------

@Serializable
data class StandingGoalsDto(val `for`: Int? = null, val against: Int? = null)

@Serializable
data class StandingAllDto(
    val played: Int? = null,
    val win: Int? = null,
    val draw: Int? = null,
    val lose: Int? = null,
    val goals: StandingGoalsDto? = null,
)

@Serializable
data class StandingRowDto(
    val rank: Int? = null,
    val team: TeamDto? = null,
    val points: Int? = null,
    val goalsDiff: Int? = null,
    /**
     * The group label, e.g. "المجموعة أ". Null on a single-table league — which
     * is how the UI knows not to split it into one pointless section.
     */
    val group: String? = null,
    val description: String? = null,
    val all: StandingAllDto? = null,
)

@Serializable
data class StandingsDto(
    val league: LeagueDto? = null,
    /** A list of groups, each a list of rows. */
    val standings: List<List<StandingRowDto>>? = null,
)

// --- Top scorers -----------------------------------------------------------

@Serializable
data class ScorerPlayerDto(
    val id: Int? = null,
    val name: String? = null,
    val photo: String? = null,
    val nationality: String? = null,
)

@Serializable
data class ScorerGamesDto(val appearences: Int? = null)

@Serializable
data class ScorerGoalsDto(val total: Int? = null, val assists: Int? = null)

@Serializable
data class ScorerPenaltyDto(val scored: Int? = null)

@Serializable
data class ScorerStatDto(
    val team: TeamDto? = null,
    val games: ScorerGamesDto? = null,
    val goals: ScorerGoalsDto? = null,
    val penalty: ScorerPenaltyDto? = null,
)

@Serializable
data class ScorerDto(
    val player: ScorerPlayerDto? = null,
    val statistics: List<ScorerStatDto>? = null,
)

@Serializable
data class TopScorersDto(
    val topScorers: List<ScorerDto>? = null,
    /** Present with a message when the source had nothing, rather than a fault. */
    val error: String? = null,
)

/** The shape the backend answers with when an endpoint has no data. */
@Serializable
data class EmptyMarkerDto(val error: String? = null)
