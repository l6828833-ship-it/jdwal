package co.jdwal.football.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.jdwal.football.R
import co.jdwal.football.data.Repository
import co.jdwal.football.domain.CuratedLeague
import co.jdwal.football.domain.Leagues
import co.jdwal.football.domain.StandingRow
import co.jdwal.football.ui.components.Crest
import co.jdwal.football.ui.components.EmptyState
import co.jdwal.football.ui.components.ErrorState
import co.jdwal.football.ui.components.FullScreenLoading

/** The curated competitions, in editorial order. */
@Composable
fun LeaguesScreen(
    onOpenLeague: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier
            .fillMaxSize()
            .padding(horizontal = 12.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp),
    ) {
        items(Leagues.CURATED, key = CuratedLeague::id) { league ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .clickable { onOpenLeague(league.id) }
                    .padding(vertical = 12.dp, horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Crest(url = null, name = league.name, size = 26)
                Text(text = league.name, fontSize = 13.sp)
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outline)
        }
    }
}

/**
 * A competition's table.
 *
 * Rows arrive as one flat list carrying a group label, so a multi-group cup is
 * split back out by that label. Without it, "1" appears once per group and the
 * ranking reads as nonsense — a World Cup table would show position 1 twelve
 * times. A single-table league carries no label and must NOT be split into one
 * pointless section.
 */
@Composable
fun StandingsScreen(
    leagueId: Int,
    repository: Repository,
    modifier: Modifier = Modifier,
) {
    var rows by remember { mutableStateOf<List<StandingRow>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var failed by remember { mutableStateOf(false) }
    var reloadToken by remember { mutableStateOf(0) }
    val context = LocalContext.current

    LaunchedEffect(leagueId, reloadToken) {
        loading = true
        failed = false
        runCatching { repository.standings(leagueId) }
            .onSuccess { rows = it.second; loading = false }
            .onFailure { loading = false; failed = true }
    }

    when {
        loading && rows.isEmpty() -> FullScreenLoading(modifier)
        failed && rows.isEmpty() -> ErrorState({ reloadToken++ }, modifier)
        rows.isEmpty() -> EmptyState(context.getString(R.string.empty_no_standings), modifier)
        else -> {
            val groups = rows
                .groupBy { it.group }
                .toList()
                // A null label means a single table; it must stay one block.
                .let { if (it.size == 1) listOf(null to rows) else it }

            LazyColumn(
                modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 8.dp),
            ) {
                groups.forEach { (groupName, groupRows) ->
                    if (groupName != null) {
                        item(key = "h-$groupName") {
                            Text(
                                text = groupName,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
                            )
                        }
                    }
                    item(key = "head-${groupName ?: "single"}") { TableHeader() }
                    items(groupRows, key = { "${groupName}-${it.position}-${it.team.id}" }) { row ->
                        StandingRowView(row)
                    }
                }
            }
        }
    }
}

@Composable
private fun TableHeader() {
    val context = LocalContext.current
    Row(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(vertical = 6.dp, horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Cell("#", 24.dp)
        Text(
            text = context.getString(R.string.col_team),
            modifier = Modifier.weight(1f),
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Cell(context.getString(R.string.col_played), 28.dp)
        Cell(context.getString(R.string.col_diff), 32.dp)
        Cell(context.getString(R.string.col_points), 32.dp)
    }
}

@Composable
private fun StandingRowView(row: StandingRow) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp, horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Cell(row.position.toString(), 24.dp)
        Row(
            Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Crest(url = row.team.logo, name = row.team.name, size = 20)
            Text(text = row.team.name, fontSize = 12.sp, maxLines = 1)
        }
        Cell(row.played?.toString() ?: "–", 28.dp)
        Cell(
            row.goalDifference?.let { if (it > 0) "+$it" else it.toString() } ?: "–",
            32.dp,
        )
        Cell(row.points?.toString() ?: "–", 32.dp, bold = true)
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outline)
}

@Composable
private fun Cell(text: String, width: androidx.compose.ui.unit.Dp, bold: Boolean = false) {
    Text(
        text = text,
        modifier = Modifier.width(width),
        fontSize = 11.sp,
        fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
        textAlign = TextAlign.Center,
        color = if (bold) MaterialTheme.colorScheme.onSurface
        else MaterialTheme.colorScheme.onSurfaceVariant,
    )
}
