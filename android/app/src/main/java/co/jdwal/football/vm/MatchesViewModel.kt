package co.jdwal.football.vm

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import co.jdwal.football.data.Repository
import co.jdwal.football.domain.LeagueGroup
import co.jdwal.football.util.Time
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

data class MatchesState(
    val selectedDate: LocalDate = Time.today(),
    val dateRange: List<LocalDate> = emptyList(),
    val groups: List<LeagueGroup> = emptyList(),
    val loading: Boolean = true,
    val failed: Boolean = false,
    val nowUnix: Long = Time.nowUnix(),
    /** When the data on screen was fetched, so the live clock can advance it. */
    val reportedAtUnix: Long = Time.nowUnix(),
) {
    val hasLiveMatch: Boolean
        get() = groups.any { group -> group.matches.any { it.isLive } }
}

class MatchesViewModel(
    private val repository: Repository = Repository(),
) : ViewModel() {

    private val _state = MutableStateFlow(
        MatchesState(dateRange = buildRange(Time.today())),
    )
    val state: StateFlow<MatchesState> = _state.asStateFlow()

    private var pollJob: Job? = null
    private var tickJob: Job? = null

    init {
        load(_state.value.selectedDate, force = false)
        startTicking()
    }

    fun selectDate(date: LocalDate) {
        if (date == _state.value.selectedDate) return
        _state.update { it.copy(selectedDate = date, loading = true, failed = false) }
        load(date, force = false)
    }

    fun refresh(force: Boolean = true) {
        _state.update { it.copy(loading = true, failed = false) }
        load(_state.value.selectedDate, force = force)
    }

    private fun load(date: LocalDate, force: Boolean) {
        viewModelScope.launch {
            runCatching { repository.dayGroups(date, force) }
                .onSuccess { groups ->
                    // Guard against a slow response for a day the user has since
                    // navigated away from overwriting the day now on screen.
                    if (date != _state.value.selectedDate) return@onSuccess
                    val now = Time.nowUnix()
                    _state.update {
                        it.copy(
                            groups = groups,
                            loading = false,
                            failed = false,
                            nowUnix = now,
                            reportedAtUnix = now,
                        )
                    }
                }
                .onFailure {
                    if (date != _state.value.selectedDate) return@onFailure
                    // Existing data stays on screen; only the flag changes, so a
                    // failed refresh never blanks a list that already loaded.
                    _state.update { it.copy(loading = false, failed = true) }
                }
        }
    }

    /** Refetches while a match is in play, and not otherwise. */
    fun startPollingIfNeeded() {
        pollJob?.cancel()
        if (!_state.value.hasLiveMatch) return
        pollJob = viewModelScope.launch {
            while (true) {
                delay(POLL_SECONDS * 1000)
                load(_state.value.selectedDate, force = true)
            }
        }
    }

    /**
     * Advances the displayed clock between polls, so a live minute ticks without
     * a request. Cheap: one state update a minute, and only while something is
     * live.
     */
    private fun startTicking() {
        tickJob?.cancel()
        tickJob = viewModelScope.launch {
            while (true) {
                delay(30_000)
                if (_state.value.hasLiveMatch) {
                    _state.update { it.copy(nowUnix = Time.nowUnix()) }
                }
            }
        }
    }

    override fun onCleared() {
        pollJob?.cancel()
        tickJob?.cancel()
        super.onCleared()
    }

    private companion object {
        const val POLL_SECONDS = 30L

        /** Yesterday through the next five days, which covers normal browsing. */
        fun buildRange(today: LocalDate): List<LocalDate> =
            (-1..5).map { today.plusDays(it.toLong()) }
    }
}
