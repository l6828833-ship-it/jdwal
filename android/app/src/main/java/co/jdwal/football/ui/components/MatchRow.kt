package co.jdwal.football.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.jdwal.football.R
import co.jdwal.football.domain.Match
import co.jdwal.football.domain.MatchStatus
import co.jdwal.football.domain.Status
import co.jdwal.football.util.Time

/**
 * One fixture.
 *
 * The centre column is fixed width and holds exactly one thing: the kickoff time
 * before the match, the score once it is under way. Letting it size to content
 * made every row in a list shift horizontally as matches kicked off.
 */
@Composable
fun MatchRow(
    match: Match,
    nowUnix: Long,
    reportedAtUnix: Long,
    onClick: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = androidx.compose.ui.platform.LocalContext.current

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick(match.id) }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TeamSide(
            name = match.home.name,
            logo = match.home.logo,
            modifier = Modifier.weight(1f),
        )

        Column(
            modifier = Modifier.width(72.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            when {
                match.score.home != null && match.score.away != null -> Text(
                    text = "${match.score.home} - ${match.score.away}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                )

                match.status == MatchStatus.POSTPONED -> Text(
                    text = context.getString(R.string.status_postponed),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                match.status == MatchStatus.CANCELLED -> Text(
                    text = context.getString(R.string.status_cancelled),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                else -> Text(
                    text = Time.kickoff(match.kickoffUnix),
                    fontWeight = FontWeight.Medium,
                    fontSize = 14.sp,
                )
            }

            when {
                match.isHalfTime -> Text(
                    text = context.getString(R.string.status_half_time),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error,
                )

                match.isLive -> {
                    val minute = Status.displayMinute(
                        match.status,
                        match.minute,
                        reportedAtUnix,
                        nowUnix,
                    )
                    LiveBadge(minuteLabel = minute?.let { "$it'" } ?: context.getString(R.string.status_live))
                }

                match.status == MatchStatus.FINISHED -> Text(
                    text = context.getString(R.string.status_finished),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        TeamSide(
            name = match.away.name,
            logo = match.away.logo,
            modifier = Modifier.weight(1f),
            alignEnd = true,
        )
    }
}

@Composable
private fun TeamSide(
    name: String,
    logo: String?,
    modifier: Modifier = Modifier,
    alignEnd: Boolean = false,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = if (alignEnd) Arrangement.End else Arrangement.Start,
    ) {
        if (alignEnd) {
            TeamName(name, alignEnd)
            Crest(url = logo, name = name, size = 24, modifier = Modifier.padding(start = 8.dp))
        } else {
            Crest(url = logo, name = name, size = 24, modifier = Modifier.padding(end = 8.dp))
            TeamName(name, alignEnd)
        }
    }
}

@Composable
private fun TeamName(name: String, alignEnd: Boolean) {
    Text(
        text = name,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        fontSize = 13.sp,
        textAlign = if (alignEnd) TextAlign.End else TextAlign.Start,
    )
}
