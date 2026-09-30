package co.jdwal.football.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import co.jdwal.football.R
import co.jdwal.football.domain.LeagueGroup
import co.jdwal.football.ui.components.Crest
import co.jdwal.football.ui.components.EmptyState
import co.jdwal.football.ui.components.ErrorState
import co.jdwal.football.ui.components.FullScreenLoading
import co.jdwal.football.ui.components.MatchRow
import co.jdwal.football.util.Time
import co.jdwal.football.vm.MatchesViewModel
import java.time.LocalDate

/**
 * The day's fixtures, grouped by competition.
 *
 * The date strip is the primary control and it is built around TODAY in the
 * device's zone — not the server's. That is the whole reason `Time` takes a zone
 * everywhere: the heading, the request and the kickoff times all have to agree
 * about where midnight falls.
 */
@Composable
fun MatchesScreen(
    viewModel: MatchesViewModel,
    onOpenMatch: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // Polls only while something is actually in play, and stops when it is not —
    // a timer that runs all day on a fixture list is a battery complaint.
    LaunchedEffect(state.selectedDate, state.hasLiveMatch) {
        viewModel.startPollingIfNeeded()
    }

    Column(modifier.fillMaxSize()) {
        DateStrip(
            dates = state.dateRange,
            selected = state.selectedDate,
            onSelect = viewModel::selectDate,
        )

        HorizontalDivider(color = MaterialTheme.colorScheme.outline)

        when {
            state.loading && state.groups.isEmpty() -> FullScreenLoading()

            state.failed && state.groups.isEmpty() -> ErrorState(
                onRetry = { viewModel.refresh(force = true) },
            )

            state.groups.isEmpty() -> EmptyState(
                text = context.getString(R.string.empty_no_matches),
            )

            else -> LazyColumn(
                state = rememberLazyListState(),
                modifier = Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(
                    vertical = 8.dp,
                ),
            ) {
                items(state.groups, key = { it.league.id }) { group ->
                    LeagueBlock(
                        group = group,
                        nowUnix = state.nowUnix,
                        reportedAtUnix = state.reportedAtUnix,
                        onOpenMatch = onOpenMatch,
                    )
                }
            }
        }
    }
}

@Composable
private fun DateStrip(
    dates: List<LocalDate>,
    selected: LocalDate,
    onSelect: (LocalDate) -> Unit,
) {
    val today = Time.today()
    val context = LocalContext.current

    LazyRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(dates, key = { it.toEpochDay() }) { date ->
            val label = when (date) {
                today -> context.getString(R.string.date_today)
                today.minusDays(1) -> context.getString(R.string.date_yesterday)
                today.plusDays(1) -> context.getString(R.string.date_tomorrow)
                else -> Time.shortDay(date)
            }
            FilterChip(
                selected = date == selected,
                onClick = { onSelect(date) },
                label = { Text(label, fontSize = 12.sp) },
            )
        }
    }
}

@Composable
private fun LeagueBlock(
    group: LeagueGroup,
    nowUnix: Long,
    reportedAtUnix: Long,
    onOpenMatch: (Int) -> Unit,
) {
    Column(
        Modifier
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surface),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Crest(url = group.league.logo, name = group.league.name, size = 18)
            Text(
                text = group.league.name,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.outline)

        group.matches.forEachIndexed { index, match ->
            MatchRow(
                match = match,
                nowUnix = nowUnix,
                reportedAtUnix = reportedAtUnix,
                onClick = onOpenMatch,
            )
            if (index != group.matches.lastIndex) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outline)
            }
        }
    }
}
