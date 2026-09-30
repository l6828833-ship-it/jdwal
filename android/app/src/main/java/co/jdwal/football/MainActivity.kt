package co.jdwal.football

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material.icons.filled.Whatshot
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import co.jdwal.football.data.Repository
import co.jdwal.football.domain.Leagues
import co.jdwal.football.ui.screens.LeaguesScreen
import co.jdwal.football.ui.screens.MatchDetailScreen
import co.jdwal.football.ui.screens.MatchesScreen
import co.jdwal.football.ui.screens.ScorersScreen
import co.jdwal.football.ui.screens.StandingsScreen
import co.jdwal.football.ui.theme.FootballLiveTheme
import co.jdwal.football.vm.MatchesViewModel

/**
 * The whole app: three tabs and two detail screens, all native Compose.
 *
 * No WebView anywhere. A wrapped website is rejected by Play review as having no
 * functionality beyond the site, and it would also mean shipping the cookie
 * banner, the ad slots and the desktop layout into a phone app.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FootballLiveTheme {
                App()
            }
        }
    }
}

private sealed class Tab(val route: String, val labelRes: Int, val icon: ImageVector) {
    data object Matches : Tab("matches", R.string.tab_matches, Icons.Filled.SportsSoccer)
    data object Scorers : Tab("scorers", R.string.tab_scorers, Icons.Filled.Whatshot)
    data object Leagues : Tab("leagues", R.string.tab_leagues, Icons.Filled.EmojiEvents)
}

private val TABS = listOf(Tab.Matches, Tab.Scorers, Tab.Leagues)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun App() {
    val navController = rememberNavController()
    // One repository for the whole app, so its cache is shared across tabs
    // instead of each screen refetching the same day.
    val repository = remember { Repository() }
    val backStack by navController.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    val context = LocalContext.current

    val isDetail = route?.startsWith("match/") == true || route?.startsWith("league/") == true

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = when {
                            route?.startsWith("league/") == true -> {
                                val id = backStack?.arguments?.getInt("leagueId") ?: 0
                                Leagues.curatedName(id) ?: context.getString(R.string.tab_leagues)
                            }
                            route?.startsWith("match/") == true ->
                                context.getString(R.string.title_match)
                            route == Tab.Scorers.route -> context.getString(R.string.tab_scorers)
                            route == Tab.Leagues.route -> context.getString(R.string.tab_leagues)
                            else -> context.getString(R.string.app_name)
                        },
                        fontSize = 16.sp,
                    )
                },
                navigationIcon = {
                    if (isDetail) {
                        IconButton(onClick = { navController.popBackStack() }) {
                            Icon(
                                // AutoMirrored: the arrow must point the other
                                // way in an RTL layout, which this app is.
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = stringResource(R.string.action_back),
                            )
                        }
                    }
                },
            )
        },
        bottomBar = {
            // Hidden on detail screens: a back arrow and a tab bar competing for
            // the same gesture is how people end up unsure where "back" goes.
            if (!isDetail) {
                NavigationBar {
                    TABS.forEach { tab ->
                        val selected = backStack?.destination?.hierarchy
                            ?.any { it.route == tab.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = null) },
                            label = { Text(stringResource(tab.labelRes), fontSize = 11.sp) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Tab.Matches.route,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            composable(Tab.Matches.route) {
                val vm: MatchesViewModel = viewModel()
                MatchesScreen(
                    viewModel = vm,
                    onOpenMatch = { navController.navigate("match/$it") },
                )
            }

            composable(Tab.Scorers.route) {
                ScorersScreen(repository = repository)
            }

            composable(Tab.Leagues.route) {
                LeaguesScreen(onOpenLeague = { navController.navigate("league/$it") })
            }

            composable(
                route = "match/{matchId}",
                arguments = listOf(
                    androidx.navigation.navArgument("matchId") {
                        type = androidx.navigation.NavType.IntType
                    },
                ),
            ) { entry ->
                MatchDetailScreen(
                    matchId = entry.arguments?.getInt("matchId") ?: 0,
                    repository = repository,
                )
            }

            composable(
                route = "league/{leagueId}",
                arguments = listOf(
                    androidx.navigation.navArgument("leagueId") {
                        type = androidx.navigation.NavType.IntType
                    },
                ),
            ) { entry ->
                StandingsScreen(
                    leagueId = entry.arguments?.getInt("leagueId") ?: 0,
                    repository = repository,
                )
            }
        }
    }
}
