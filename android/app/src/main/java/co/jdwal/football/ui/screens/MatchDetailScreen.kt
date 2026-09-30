package co.jdwal.football.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.jdwal.football.R
import co.jdwal.football.data.Repository
import co.jdwal.football.domain.EventKind
import co.jdwal.football.domain.Match
import co.jdwal.football.domain.MatchEvent
import co.jdwal.football.ui.components.Crest
import co.jdwal.football.ui.components.ErrorState
import co.jdwal.football.ui.components.FullScreenLoading
import co.jdwal.football.util.Time

/**
 * One match: score, the incident timeline, then the facts.
 *
 * The timeline is the reason this screen exists rather than a row expansion. It
 * carries goals AND cards, missed penalties and goals ruled out — the fixtures
 * list endpoint has none of that, only the single-fixture route does.
 */
@Composable
fun MatchDetailScreen(
    matchId: Int,
    repository: Repository,
    modifier: Modifier = Modifier,
) {
    var match by remember { mutableStateOf<Match?>(null) }
    var failed by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var reloadToken by remember { mutableStateOf(0) }

    LaunchedEffect(matchId, reloadToken) {
        loading = true
        failed = false
        runCatching { repository.match(matchId) }
            .onSuccess { match = it; loading = false; failed = it == null }
            .onFailure { loading = false; failed = true }
    }

    when {
        loading && match == null -> FullScreenLoading(modifier)
        failed && match == null -> ErrorState({ reloadToken++ }, modifier)
        match != null -> MatchDetailContent(match!!, modifier)
    }
}

@Composable
private fun MatchDetailContent(match: Match, modifier: Modifier = Modifier) {
    val context = LocalContext.current

    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(bottom = 24.dp),
    ) {
        ScoreHeader(match)

        val events = match.events
        if (!events.isNullOrEmpty()) {
            SectionCard(title = context.getString(R.string.section_events)) {
                events.forEachIndexed { index, event ->
                    EventRow(event, match)
                    if (index != events.lastIndex) {
                        HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                    }
                }
            }
        }

        SectionCard(title = context.getString(R.string.section_info)) {
            InfoRow(context.getString(R.string.info_competition), match.league.name)
            match.league.round?.let {
                InfoRow(context.getString(R.string.info_round), it)
            }
            InfoRow(context.getString(R.string.info_kickoff), Time.kickoff(match.kickoffUnix))
            match.venue?.let { InfoRow(context.getString(R.string.info_venue), it) }
            match.referee?.let { InfoRow(context.getString(R.string.info_referee), it) }
            if (match.channels.isNotEmpty()) {
                InfoRow(
                    context.getString(R.string.info_channel),
                    match.channels.joinToString("، "),
                )
            }
        }
    }
}

@Composable
private fun ScoreHeader(match: Match) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(vertical = 20.dp, horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TeamColumn(match.home.name, match.home.logo, Modifier.weight(1f))

        Column(
            Modifier.width(96.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val home = match.score.home
            val away = match.score.away
            Text(
                text = if (home != null && away != null) "$home - $away"
                else Time.kickoff(match.kickoffUnix),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
            )
            if (match.score.halftimeHome != null && match.score.halftimeAway != null) {
                Text(
                    text = "(${match.score.halftimeHome} - ${match.score.halftimeAway})",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        TeamColumn(match.away.name, match.away.logo, Modifier.weight(1f))
    }
}

@Composable
private fun TeamColumn(name: String, logo: String?, modifier: Modifier = Modifier) {
    Column(
        modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Crest(url = logo, name = name, size = 48)
        Text(
            text = name,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
    }
}

/**
 * One incident.
 *
 * Placed on the side it counted FOR, which for an own goal is not the scorer's
 * team — while the label still names the scorer's own club, so the row cannot
 * read as though they play for the team that benefited.
 */
@Composable
private fun EventRow(event: MatchEvent, match: Match) {
    val context = LocalContext.current
    val onHomeSide = event.scoringSideHome
    val playerTeam = if (event.playerOnHome) match.home.name else match.away.name

    val label = when (event.kind) {
        EventKind.GOAL -> null
        EventKind.PENALTY_GOAL -> context.getString(R.string.event_penalty)
        EventKind.OWN_GOAL -> context.getString(R.string.event_own_goal)
        EventKind.YELLOW -> context.getString(R.string.event_yellow)
        EventKind.RED -> context.getString(R.string.event_red)
        EventKind.SECOND_YELLOW -> context.getString(R.string.event_second_yellow)
        EventKind.MISSED_PENALTY -> context.getString(R.string.event_missed_penalty)
        EventKind.DISALLOWED -> context.getString(R.string.event_disallowed)
    }

    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "${event.minute}'",
            modifier = Modifier.width(44.dp),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            textAlign = if (onHomeSide) TextAlign.Start else TextAlign.End,
        )

        Column(
            Modifier
                .weight(1f)
                .padding(horizontal = 8.dp),
            horizontalAlignment = if (onHomeSide) Alignment.Start else Alignment.End,
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                EventMarker(event.kind)
                Text(text = event.player, fontSize = 13.sp, maxLines = 1)
            }
            val sub = listOfNotNull(playerTeam, label, event.assist?.let {
                "${context.getString(R.string.event_assist)}: $it"
            }).joinToString(" · ")
            Text(
                text = sub,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
            )
        }
    }
}

/**
 * Cards are drawn as coloured blocks, not 🟨/🟥: the emoji render inconsistently
 * across devices and are close to invisible on a dark background on some. The
 * meaning is in `contentDescription`, so it is announced rather than only seen.
 */
@Composable
private fun EventMarker(kind: EventKind) {
    val context = LocalContext.current
    when (kind) {
        EventKind.YELLOW -> CardMarker(Color(0xFFFBBF24), context.getString(R.string.event_yellow))
        EventKind.RED -> CardMarker(Color(0xFFEF4444), context.getString(R.string.event_red))
        EventKind.SECOND_YELLOW ->
            CardMarker(Color(0xFFEF4444), context.getString(R.string.event_second_yellow))
        EventKind.GOAL, EventKind.PENALTY_GOAL -> Text("⚽", fontSize = 13.sp)
        EventKind.OWN_GOAL -> Text("🥅", fontSize = 13.sp)
        EventKind.MISSED_PENALTY -> Text("✖", fontSize = 13.sp)
        EventKind.DISALLOWED -> Text("⃠", fontSize = 13.sp)
    }
}

@Composable
private fun CardMarker(color: Color, description: String) {
    Box(
        Modifier
            .size(width = 9.dp, height = 13.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(color)
            // The card's meaning is carried by colour alone visually, so it is
            // stated here too — otherwise a screen reader announces nothing.
            .semantics { contentDescription = description },
    )
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Column(
        Modifier
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface),
    ) {
        Text(
            text = title,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
        HorizontalDivider(color = MaterialTheme.colorScheme.outline)
        content()
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(text = value, fontSize = 12.sp, maxLines = 2)
    }
}
