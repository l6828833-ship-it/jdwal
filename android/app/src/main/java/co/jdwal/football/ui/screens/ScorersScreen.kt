package co.jdwal.football.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.jdwal.football.R
import co.jdwal.football.data.Repository
import co.jdwal.football.domain.Leagues
import co.jdwal.football.domain.TopScorer
import co.jdwal.football.ui.components.Crest
import co.jdwal.football.ui.components.EmptyState
import co.jdwal.football.ui.components.ErrorState
import co.jdwal.football.ui.components.FullScreenLoading

/**
 * Top scorers, one competition at a time.
 *
 * The tab strip is the first twelve curated competitions — a short, stable list,
 * so the screen loads without first fetching a catalogue. An empty leaderboard is
 * a normal state, not a failure: plenty of cups have no scorer table at all, and
 * a competition between seasons has none yet.
 */
@Composable
fun ScorersScreen(
    repository: Repository,
    modifier: Modifier = Modifier,
) {
    val tabs = remember { Leagues.CURATED.take(12) }
    var selectedIndex by remember { mutableIntStateOf(0) }
    var scorers by remember { mutableStateOf<List<TopScorer>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var failed by remember { mutableStateOf(false) }
    var reloadToken by remember { mutableStateOf(0) }
    val context = LocalContext.current

    val selected = tabs[selectedIndex]

    LaunchedEffect(selected.id, reloadToken) {
        loading = true
        failed = false
        scorers = emptyList()
        runCatching { repository.scorers(selected.id) }
            .onSuccess { scorers = it; loading = false }
            .onFailure { loading = false; failed = true }
    }

    Column(modifier.fillMaxSize()) {
        LazyRow(
            Modifier
                .fillMaxWidth()
                .padding(vertical = 8.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(tabs.size, key = { tabs[it].id }) { index ->
                FilterChip(
                    selected = index == selectedIndex,
                    onClick = { selectedIndex = index },
                    label = { Text(tabs[index].name, fontSize = 12.sp, maxLines = 1) },
                )
            }
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.outline)

        when {
            loading -> FullScreenLoading()
            failed -> ErrorState({ reloadToken++ })
            scorers.isEmpty() -> EmptyState(context.getString(R.string.empty_no_scorers))
            else -> LazyColumn(
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp),
            ) {
                item(key = "header") { ScorersHeader() }
                items(scorers, key = { "${it.rank}-${it.player}" }) { ScorerRow(it) }
            }
        }
    }
}

@Composable
private fun ScorersHeader() {
    val context = LocalContext.current
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("#", Modifier.width(24.dp), fontSize = 11.sp, textAlign = TextAlign.Center)
        Text(
            text = context.getString(R.string.col_player),
            modifier = Modifier.weight(1f),
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = context.getString(R.string.col_assists),
            modifier = Modifier.width(40.dp),
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = context.getString(R.string.col_goals),
            modifier = Modifier.width(40.dp),
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outline)
}

@Composable
private fun ScorerRow(scorer: TopScorer) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = scorer.rank.toString(),
            modifier = Modifier.width(24.dp),
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(
            Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Crest(url = scorer.photo, name = scorer.player, size = 26)
            Column {
                Text(text = scorer.player, fontSize = 12.sp, maxLines = 1)
                scorer.teamName?.let {
                    Text(
                        text = it,
                        fontSize = 10.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                }
            }
        }
        Text(
            text = scorer.assists?.toString() ?: "–",
            modifier = Modifier.width(40.dp),
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = scorer.goals?.toString() ?: "–",
            modifier = Modifier.width(40.dp),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outline)
}
