"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateSelector } from "./date-selector";
import { FilterTabs, type MatchFilter } from "./filter-tabs";
import { LeagueGroup } from "./league-group";
import { LivePill } from "./live-badge";
import { TopBar } from "./top-bar";
import { useTimezone } from "./timezone-provider";
import { useServerNow } from "./use-server-now";
import { groupByLeague, isPopularMatch } from "@/lib/grouping";
import { LIVE_POLL_SECONDS } from "@/lib/config";
import { toDateKey } from "@/lib/date";
import { t } from "@/lib/i18n";
import type { MatchesPayload } from "@/lib/types";

interface MatchesViewProps {
  initialPayload: MatchesPayload;
}

export function MatchesView({ initialPayload }: MatchesViewProps) {
  const timezone = useTimezone();

  /**
   * The day the user explicitly navigated to, or null while they are simply on
   * "today". Keeping it null means the effective date is DERIVED from `today`,
   * so it follows the viewer's timezone (and a midnight rollover) on its own,
   * with no state to keep in sync.
   */
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [payload, setPayload] = useState(initialPayload);
  const [filter, setFilter] = useState<MatchFilter>("all");
  const [liveOnly, setLiveOnly] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const liveCount = useMemo(
    () => payload.matches.filter((match) => match.status === "live").length,
    [payload.matches],
  );

  /**
   * Current time, anchored to the timestamp the server sent with the payload
   * and advanced by a monotonic timer — never read from the device clock, which
   * on a misconfigured machine is hours out. See useServerNow.
   */
  const nowUnix = useServerNow(payload.nowUnix, liveCount > 0);

  /**
   * "Today" in the viewer's timezone, off the server's clock.
   *
   * Both inputs come from the server (the zone is resolved from the visitor's
   * IP), so this matches what was rendered and hydration is clean — and a
   * device with the wrong date can no longer land the app on the wrong day.
   */
  const today = useMemo(
    () => toDateKey(new Date(nowUnix * 1000), timezone),
    [nowUnix, timezone],
  );

  const date = pickedDate ?? today;

  /**
   * We're loading a new day exactly while the payload we hold isn't yet for the
   * selected date and no error has surfaced. This avoids a separate loading
   * flag (and the setState-in-effect it would require).
   */
  const showingSelectedDate = payload.date === date;
  const loading = !showingSelectedDate && !error;

  /**
   * The day the newest request was made for.
   *
   * Guards against a slow response for an OLD day overwriting a newer one —
   * but it must key on the DATE, not on a bare counter. With a counter, a
   * background poll firing at the same moment as a day change bumped the
   * sequence and the navigation's own response was then thrown away, so
   * `payload.date` never caught up and the view sat on "loading" forever
   * (including when returning to today). Comparing the target date instead
   * means a response is accepted whenever it is still the day we want, no
   * matter how many polls raced alongside it.
   */
  const wantedDate = useRef(initialPayload.date);

  const load = useCallback(
    async (targetDate: string, background = false) => {
      // A background poll must not steal the "wanted day" from a navigation
      // that is still in flight; it only ever refreshes the day on screen.
      if (!background) wantedDate.current = targetDate;

      try {
        const url =
          `/api/matches?date=${encodeURIComponent(targetDate)}` +
          (background ? "&bg=1" : "");
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string; code?: string }
            | null;
          // The daily request budget is a distinct, expected condition — show a
          // clear Arabic notice rather than a generic failure.
          if (response.status === 503 && body?.code === "budget_exhausted") {
            if (targetDate === wantedDate.current) setError(t.quotaNotice);
            return;
          }
          throw new Error(body?.error || `HTTP ${response.status}`);
        }
        const next = (await response.json()) as MatchesPayload;

        // Accept only if this is still the day the user is looking at.
        if (next.date !== wantedDate.current) return;

        // Replace state in one commit so the list never renders empty midway.
        // `next.nowUnix` also re-anchors the clock, via useServerNow above.
        setPayload(next);
        setError(null);
      } catch (cause) {
        if (targetDate !== wantedDate.current) return;
        setError(cause instanceof Error ? cause.message : t.loadFailed);
      }
    },
    [],
  );

  const handleSelectDate = useCallback(
    (nextDate: string) => {
      if (nextDate === date) return;
      // Selecting today clears the pin so the view resumes following "today".
      setPickedDate(nextDate === today ? null : nextDate);
      setLiveOnly(false);
      setError(null);
    },
    [date, today],
  );

  /**
   * Load whenever the effective day differs from the data we hold.
   *
   * Covers both cases with one path: the user picking a day, and the server's
   * fallback timezone turning out to be a day off from the viewer's real one.
   */
  useEffect(() => {
    if (payload.date === date) return;
    // react-hooks/set-state-in-effect fires on any call to a function that can
    // setState. It does not apply here: `load` reaches its first `await` before
    // touching state, so nothing commits synchronously and no cascading render
    // occurs. Fetching in response to a changed dependency is the intended use.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(date);
  }, [date, payload.date, load]);

  /**
   * Is a match on the current day due to kick off within the next ~15 minutes?
   * Used to briefly wake polling so a starting match is picked up, without
   * polling all day when nothing is live.
   */
  const kickoffImminent = useMemo(() => {
    if (!showingSelectedDate) return false;
    const soon = nowUnix + 60 * 60;
    return payload.matches.some(
      (m) => m.status === "scheduled" && m.kickoffUnix <= soon && m.kickoffUnix >= nowUnix - 5 * 60,
    );
  }, [showingSelectedDate, payload.matches, nowUnix]);

  /**
   * Whether the day being shown could contain a live match now — today in the
   * viewer's zone, or the day either side of it (a match kicking off late runs
   * past UTC midnight, and viewers span timezones).
   */
  const dayCanBeLive = useMemo(() => {
    if (!showingSelectedDate) return false;
    const shownNoon = Date.parse(`${date}T12:00:00Z`);
    const todayNoon = Date.parse(`${today}T12:00:00Z`);
    return Math.abs(shownNoon - todayNoon) <= 24 * 60 * 60 * 1000;
  }, [showingSelectedDate, date, today]);

  /**
   * When to poll so scores, goals and status update WITHOUT a manual reload.
   *
   * Polls whenever a match is live, one kicks off within the hour, or simply
   * whenever the viewed day is today — so a fixture flipping from scheduled to
   * live is picked up on its own. The self-hosted backend has no request quota
   * (it scrapes public pages and caches), so polling today all day is free; the
   * server-side cache means N browsers still cost one upstream fetch per
   * interval. Polling always pauses while the tab is hidden.
   */
  const shouldPoll = liveCount > 0 || kickoffImminent || dayCanBeLive;

  useEffect(() => {
    if (!shouldPoll) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      // background=true: a poll refreshes the day on screen and must never
      // take over the "wanted day" from a navigation still in flight.
      timer = setInterval(
        () => void load(date, true),
        LIVE_POLL_SECONDS * 1000,
      );
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load(date, true);
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [shouldPoll, date, load]);

  const counts = useMemo(
    () => ({
      all: payload.matches.length,
      top: payload.matches.filter(isPopularMatch).length,
    }),
    [payload.matches],
  );

  const groups = useMemo(() => {
    if (!showingSelectedDate) return [];
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = payload.matches.filter((match) => {
      if (filter === "top" && !isPopularMatch(match)) return false;
      if (liveOnly && match.status !== "live") return false;
      if (normalizedQuery) {
        const haystack = [
          match.home.name,
          match.away.name,
          match.home.nameOriginal,
          match.away.nameOriginal,
          match.league.name,
          match.league.nameOriginal,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });

    return groupByLeague(filtered);
  }, [showingSelectedDate, payload.matches, filter, liveOnly, query]);

  const emptyMessage = !showingSelectedDate
    ? error === t.quotaNotice
      ? t.quotaNotice
      : error
        ? t.loadFailed
        : t.loading
    : query.trim()
      ? t.noResults
      : liveOnly
        ? t.noLiveMatches
        : filter === "top"
          ? t.noMatchesTop
          : t.noMatches;

  return (
    <>
      <TopBar
        searchOpen={searchOpen}
        query={query}
        onToggleSearch={() => {
          setSearchOpen((open) => {
            if (open) setQuery("");
            return !open;
          });
        }}
        onQueryChange={setQuery}
      />

      <div className="flex flex-col gap-3 px-3 pt-3 sm:px-4">
        <DateSelector selected={date} today={today} onSelect={handleSelectDate} />

        <div className="flex items-center justify-between gap-2">
          <FilterTabs value={filter} onChange={setFilter} counts={counts} />
          <LivePill
            count={liveCount}
            active={liveOnly}
            onToggle={() => setLiveOnly((value) => !value)}
          />
        </div>

        {/* Fixed-height status strip: reserving the space means showing or
            clearing a notice never shifts the list below it. */}
        <div className="flex h-4 items-center justify-center" aria-live="polite">
          {loading && (
            <span className="text-[0.68rem] font-medium text-muted-dim">···</span>
          )}
          {!loading && error && (
            <span
              className={`text-[0.68rem] font-medium ${
                error === t.quotaNotice ? "text-muted-dim" : "text-live-red"
              }`}
            >
              {error === t.quotaNotice ? t.quotaNotice : t.loadFailed}
            </span>
          )}
          {!loading && !error && payload.meta.budgetBlocked && (
            <span className="text-[0.68rem] font-medium text-muted-dim">
              {t.quotaNotice}
            </span>
          )}
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-3 px-3 pb-6 sm:px-4">
        {groups.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
            {emptyMessage}
          </p>
        ) : (
          groups.map((group) => (
            <LeagueGroup
              key={group.league.id}
              group={group}
              nowUnix={nowUnix}
              reportedAtUnix={payload.nowUnix}
            />
          ))
        )}
      </main>
    </>
  );
}
