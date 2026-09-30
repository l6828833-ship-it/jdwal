package co.jdwal.football.data

import co.jdwal.football.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.HttpUrl.Companion.toHttpUrl
import java.io.IOException
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

/**
 * The football backend, over four endpoints.
 *
 * Deliberately thin: OkHttp, kotlinx.serialization and a handful of suspend
 * functions. The interesting part is not the plumbing, it is two rules that this
 * app has to get right and that are easy to get wrong.
 *
 * FIRST: every request that is about a DAY sends `timezoneName`. A "day" of
 * fixtures runs midnight to midnight, and the source buckets by whatever zone it
 * is told. Ask in UTC while showing local times and a match kicking off at 01:00
 * in Riyadh lands in yesterday's list — the reader's own small hours go missing
 * from today. The website had exactly that bug; this app sends the DEVICE zone
 * from the start.
 *
 * SECOND: the parameter is `timezoneName`, not `timezone`. The backend ignores
 * the latter silently, which is the worst kind of wrong — it returns a valid
 * response for the wrong day.
 *
 * Every request also sends `lang`, the app's own language. Team, player and
 * competition names are localized by the SOURCE, and the backend's default is
 * Arabic because that is what the website wants; without this an English build
 * shows English chrome around Arabic team names. A backend that does not yet
 * honour `lang` simply ignores it and keeps answering in its default, so sending
 * it is safe ahead of the server change.
 */
class Api(
    private val baseUrl: String = BuildConfig.API_BASE_URL,
    private val client: OkHttpClient = defaultClient(),
) {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        explicitNulls = false
    }

    suspend fun matchesOn(dateKey: String, timezone: String): List<FixtureDto> {
        val body = get("/fixtures/getFixtures") {
            addQueryParameter("date", dateKey)
            addQueryParameter("timezoneName", timezone)
        }
        return decodeFixtureList(body)
    }

    /**
     * The language to ask the backend for names in.
     *
     * Read per request rather than captured once, because a locale change
     * recreates the activity but not necessarily this client, and a cached value
     * would keep requesting the language the app started in.
     */
    private fun lang(): String = Locale.getDefault().language.ifEmpty { "en" }

    /** One competition's recent and upcoming fixtures, for the league screen. */
    suspend fun leagueFixtures(leagueId: Int, timezone: String): LeagueFixturesDto? {
        val body = get("/fixtures/getLeagueFixtures") {
            addQueryParameter("league", leagueId.toString())
            addQueryParameter("timezoneName", timezone)
        }
        if (isEmptyMarker(body)) return null
        return runCatching { json.decodeFromString<LeagueFixturesDto>(body) }.getOrNull()
    }

    /** A single fixture, which is the only route carrying events. */
    suspend fun match(matchId: Int, timezone: String): FixtureDto? {
        val body = get("/fixtures/getFixtures") {
            addQueryParameter("id", matchId.toString())
            addQueryParameter("timezoneName", timezone)
        }
        return decodeFixtureList(body).firstOrNull()
    }

    suspend fun standings(leagueId: Int, season: Int, timezone: String): StandingsDto? {
        val body = get("/standings/getStandings") {
            addQueryParameter("league", leagueId.toString())
            addQueryParameter("season", season.toString())
            addQueryParameter("timezoneName", timezone)
        }
        if (isEmptyMarker(body)) return null
        return runCatching { json.decodeFromString<StandingsDto>(body) }.getOrNull()
    }

    suspend fun topScorers(leagueId: Int, season: Int): List<ScorerDto> {
        val body = get("/players/getTopScorers") {
            addQueryParameter("league", leagueId.toString())
            addQueryParameter("season", season.toString())
        }
        if (isEmptyMarker(body)) return emptyList()
        return runCatching {
            json.decodeFromString<TopScorersDto>(body).topScorers ?: emptyList()
        }.getOrElse { emptyList() }
    }

    /**
     * The backend answers HTTP 200 with `{"error": "..."}` when the source had
     * nothing to give. Real faults arrive as a non-2xx status, so an `error` on a
     * 200 means "no data", not "broken" — treating the two the same would show a
     * failure notice for a competition that is simply between seasons.
     */
    private fun isEmptyMarker(body: String): Boolean =
        runCatching { json.decodeFromString<EmptyMarkerDto>(body).error != null }
            .getOrDefault(false)

    private fun decodeFixtureList(body: String): List<FixtureDto> {
        if (isEmptyMarker(body)) return emptyList()
        return runCatching { json.decodeFromString<List<FixtureDto>>(body) }
            .getOrElse { emptyList() }
    }

    private suspend fun get(
        path: String,
        query: okhttp3.HttpUrl.Builder.() -> Unit,
    ): String = withContext(Dispatchers.IO) {
        val url = (baseUrl.trimEnd('/') + path).toHttpUrl().newBuilder()
            .addQueryParameter("lang", lang())
            .apply(query)
            .build()
        val request = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .build()
        client.newCall(request).await()
    }

    companion object {
        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            // A phone on a train loses connectivity constantly; failing in a few
            // seconds and letting the UI offer a retry beats a spinner that hangs.
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }
}

/** Bridges an OkHttp call into a coroutine, cancelling the call on cancellation. */
private suspend fun Call.await(): String = suspendCoroutine { cont ->
    enqueue(object : okhttp3.Callback {
        override fun onFailure(call: Call, e: IOException) = cont.resumeWithException(e)

        override fun onResponse(call: Call, response: okhttp3.Response) {
            response.use {
                if (!it.isSuccessful) {
                    cont.resumeWithException(IOException("HTTP ${it.code}"))
                } else {
                    cont.resume(it.body?.string().orEmpty())
                }
            }
        }
    })
}
