"use client";

import { useEffect, useState } from "react";

/**
 * How often the clock is recomputed. One second, so the minute advances at the
 * moment it should rather than in poll-sized jumps. A pure local recompute — no
 * request, no quota — so a fast tick costs only a re-render of the live rows.
 */
const TICK_MS = 1_000;

/**
 * Elapsed-time source. `performance.now()` counts from the page's time origin
 * and is NOT derived from the system clock, so it cannot be moved by a wrong
 * date setting, a manual change, or an NTP correction landing mid-session. It
 * also keeps counting true elapsed time while the tab is hidden and timers are
 * throttled.
 */
function monotonicMs(): number {
  return performance.now();
}

/**
 * A ticking "now" (unix seconds) anchored to the SERVER's clock and advanced by
 * a monotonic timer. The browser's wall clock is never consulted.
 *
 * Two independent failures this has to survive, both of which showed up as a
 * live minute that jumped around instead of counting:
 *
 *  • A WRONG DEVICE CLOCK. The minute is `reportedMinute + (now - reportedAt)`.
 *    If `now` came from `Date.now()` that subtraction measures the gap between
 *    two different clocks, so a machine running 8 hours fast read as ~480
 *    minutes of drift and pinned every live match to the 130' cap.
 *
 *  • A STALE PAYLOAD. `/api/matches` sits behind a CDN, and a cached response
 *    carries the `nowUnix` from when it was BUILT. A poll can therefore return a
 *    timestamp older than one already seen — a different cache layer answering,
 *    or a `stale-while-revalidate` hit. Re-anchoring on that walked the clock
 *    BACKWARDS, and the minute lurched instead of ticking.
 *
 * So the count is monotonic by construction: `base` only ever moves forward, and
 * a server timestamp is adopted only when it is genuinely ahead of where the
 * local count has already reached. Anything staler is ignored, and the local
 * tick carries on — which is exactly the behaviour that makes a slow or stale
 * feed degrade into "still counting" rather than "stuck, then jumped".
 *
 * @param serverNowUnix Server time the current payload was normalized at.
 * @param active Whether to tick at all; false while nothing is live.
 */
export function useServerNow(serverNowUnix: number, active: boolean): number {
  const [clock, setClock] = useState(() => ({
    /** Server time the count runs from. */
    base: serverNowUnix,
    /** Monotonic reading when `base` was adopted. */
    baseMs: monotonicMs(),
    /** Whole seconds counted since then. */
    elapsed: 0,
  }));

  // Tick. Deliberately keyed on `active` alone: elapsed is recomputed from
  // whatever `baseMs` is current, so adopting a new base never needs a fresh
  // interval, and the timer is not torn down and rebuilt on every poll.
  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => {
      setClock((c) => ({
        ...c,
        elapsed: Math.max(0, Math.round((monotonicMs() - c.baseMs) / 1000)),
      }));
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [active]);

  // Adopt a newer server timestamp, but only when it is AHEAD of the local
  // count. `setClock` returning `c` unchanged for a stale one means React bails
  // out without a re-render, so ignoring staleness costs nothing.
  useEffect(() => {
    // react-hooks/set-state-in-effect: syncing to a changed prop is the
    // intended use, and the updater is a no-op unless the value is newer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClock((c) =>
      serverNowUnix > c.base + c.elapsed
        ? { base: serverNowUnix, baseMs: monotonicMs(), elapsed: 0 }
        : c,
    );
  }, [serverNowUnix]);

  // First render returns `serverNowUnix` unchanged, which is what the server
  // rendered too, so hydration matches.
  return clock.base + clock.elapsed;
}
