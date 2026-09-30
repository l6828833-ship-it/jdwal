package co.jdwal.football.data

import co.jdwal.football.domain.EventKind
import co.jdwal.football.domain.LeagueRef
import co.jdwal.football.domain.Leagues
import co.jdwal.football.domain.Match
import co.jdwal.football.domain.MatchEvent
import co.jdwal.football.domain.MatchStatus
import co.jdwal.football.domain.Rounds
import co.jdwal.football.domain.Score
import co.jdwal.football.domain.StandingRow
import co.jdwal.football.domain.Status
import co.jdwal.football.domain.TeamRef
import co.jdwal.football.domain.TopScorer

/** Wire format to domain. The rules that are easy to get wrong live here. */
object Mapper {

    fun match(dto: FixtureDto, nowUnix: Long): Match? {
        val core = dto.fixture ?: return null
        val id = core.id ?: return null

        val kickoff = core.timestamp ?: 0L
        val rawStatus = Status.fromShort(core.status?.short)
        val status = Status.settle(rawStatus, kickoff, nowUnix)
        val isHalfTime = core.status?.short?.uppercase() == "HT"

        val leagueId = dto.league?.id ?: 0
        val league = LeagueRef(
            id = leagueId,
            // The curated name beats the feed's, which appends the current phase
            // and can stack several: the FA Cup arrives as "كأس الاتحاد
            // الإنجليزي - الجولات التمهيدية - دور التصفيات الأول".
            name = Leagues.curatedName(leagueId)
                ?: dto.league?.name?.trim().orEmpty().ifEmpty { "—" },
            country = dto.league?.country?.trim(),
            logo = dto.league?.logo,
            round = Rounds.label(dto.league?.round),
        )

        // A score is only shown once the match is under way; before that the feed
        // may carry zeroes, and "0 - 0" on an unplayed match is a wrong result.
        val confirmed = status == MatchStatus.LIVE || status == MatchStatus.FINISHED

        return Match(
            id = id,
            kickoffUnix = kickoff,
            status = status,
            minute = if (status == MatchStatus.LIVE) core.status?.elapsed else null,
            isHalfTime = isHalfTime,
            league = league,
            home = team(dto.teams?.home),
            away = team(dto.teams?.away),
            score = Score(
                home = if (confirmed) dto.goals?.home else null,
                away = if (confirmed) dto.goals?.away else null,
                halftimeHome = if (confirmed) dto.score?.halftime?.home else null,
                halftimeAway = if (confirmed) dto.score?.halftime?.away else null,
            ),
            venue = listOfNotNull(
                core.venue?.name?.trim()?.ifEmpty { null },
                core.venue?.city?.trim()?.ifEmpty { null },
            ).joinToString(" — ").ifEmpty { null },
            referee = core.referee?.trim()?.ifEmpty { null },
            channels = core.tvChannels?.filter { it.isNotBlank() } ?: emptyList(),
            // `null` means the feed carries no event list at all (the fixtures
            // LIST never does); an empty list means a match where nothing
            // happened. The UI needs to tell those apart.
            events = dto.events?.let { events(it, dto.teams?.home?.id) },
        )
    }

    private fun team(dto: TeamDto?): TeamRef = TeamRef(
        id = dto?.id ?: 0,
        name = dto?.name?.trim().orEmpty().ifEmpty { "—" },
        logo = dto?.logo,
    )

    /**
     * Goals, cards and the other incidents, in order.
     *
     * Classified from the backend's English `type`/`detail` pair, which it emits
     * regardless of the language the underlying feed uses — the source's own event
     * names are localized, and matching those is what once discarded every goal on
     * the website.
     */
    private fun events(list: List<EventDto>, homeId: Int?): List<MatchEvent> =
        list.mapNotNull { event ->
            val type = event.type?.lowercase().orEmpty()
            val detail = event.detail?.lowercase().orEmpty()

            val kind = when {
                type == "goal" && detail.contains("missed") -> EventKind.MISSED_PENALTY
                type == "goal" && detail.contains("own") -> EventKind.OWN_GOAL
                type == "goal" && detail.contains("penalty") -> EventKind.PENALTY_GOAL
                type == "goal" -> EventKind.GOAL
                type == "card" && detail.contains("second") -> EventKind.SECOND_YELLOW
                type == "card" && detail.contains("red") -> EventKind.RED
                type == "card" && detail.contains("yellow") -> EventKind.YELLOW
                type.contains("missed") -> EventKind.MISSED_PENALTY
                type == "var" && detail.contains("disallow") -> EventKind.DISALLOWED
                else -> null
            } ?: return@mapNotNull null

            val elapsed = event.time?.elapsed ?: 0
            val extra = event.time?.extra
            val isGoal = kind == EventKind.GOAL ||
                kind == EventKind.PENALTY_GOAL ||
                kind == EventKind.OWN_GOAL

            MatchEvent(
                minute = if (extra != null && extra > 0) "$elapsed+$extra" else "$elapsed",
                player = event.player?.name?.trim().orEmpty().ifEmpty { "—" },
                assist = if (isGoal) event.assist?.name?.trim()?.ifEmpty { null } else null,
                // The backend reports the PLAYER's team, including on own goals.
                playerOnHome = event.team?.id != null && event.team.id == homeId,
                kind = kind,
            )
        }.sortedBy { it.minute.substringBefore('+').toIntOrNull() ?: 0 }

    fun standings(dto: StandingsDto): List<StandingRow> =
        dto.standings.orEmpty().flatten().map { row ->
            StandingRow(
                position = row.rank ?: 0,
                team = team(row.team),
                group = row.group?.trim()?.ifEmpty { null },
                played = row.all?.played,
                wins = row.all?.win,
                draws = row.all?.draw,
                losses = row.all?.lose,
                goalsFor = row.all?.goals?.`for`,
                goalsAgainst = row.all?.goals?.against,
                goalDifference = row.goalsDiff,
                points = row.points,
            )
        }

    fun scorers(list: List<ScorerDto>): List<TopScorer> = list
        .filter { it.player?.id != null }
        .mapIndexed { index, dto ->
            // A player can appear for several clubs in a season; the first entry
            // is the one the leaderboard ranked them on.
            val stat = dto.statistics?.firstOrNull()
            TopScorer(
                rank = index + 1,
                player = dto.player?.name?.trim().orEmpty().ifEmpty { "—" },
                photo = dto.player?.photo,
                teamName = stat?.team?.name?.trim()?.ifEmpty { null },
                teamLogo = stat?.team?.logo,
                goals = stat?.goals?.total,
                assists = stat?.goals?.assists,
                penalties = stat?.penalty?.scored,
                appearances = stat?.games?.appearences,
            )
        }
}
