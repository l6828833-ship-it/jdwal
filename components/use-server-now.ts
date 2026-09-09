"use client";

import { useEffect, useState } from "react";

/**
 * How often the live minute is recomputed. One second, so the clock advances
 * smoothly rather than in poll-sized jumps. This is a pure local recompute — no
 * request, no quota — so a fast tick costs only a re-render of the live rows.
 */
const TICK_MS = 1_000;

/**
 * A ticking "now" (unix seconds) anchored to the SERVER's clock and advanced by
 * a MONOTONIC timer. The browser's wall clock is never consulted.
 *
 * Why this exists: the live minute is derived as
 * `reportedMinute + (now - reportedAt)`, where `reportedAt` is server time. If
 * `now` came from `Date.now()`, that subtraction silently measures the gap
 * between two DIFFERENT clocks. On a device whose system time is wrong the gap
 * is the skew, not elapsed time — a laptop running 8 hours fast turned a real
 * 74' into ~480 minutes of "drift", so every live match snapped to the 130'
 * cap immediately after the first tick. The same class of jump comes from a
 * manual date change or an NTP correction landing mid-session.
 *
 * `performance.now()` counts from the page's time origin and is not derived
 * from the system clock, so it cannot be moved by any of those. Combined with a
 * server timestamp it yields a clock that is correct on any device, however
 * badly its own is set. It also keeps counting true elapsed time while the tab
 * is hidden and timers are throttled.
 *
 * @param serverNowUnix Server time the current data was normalized at. A new
 *   value (a poll landed) re-anchors the count.
 * @param active Whether to tick at all; false while nothing is live.
 */
export function useServerNow(serverNowUnix: number, active: boolean): number {
  /**
   * `from` pairs the count with the server timestamp it was measured against,
   * so a superseded tick can be recognised on the next render.
   */
  const [tick, setTick] = useState({ from: serverNowUnix, elapsed: 0 });

  useEffect(() => {
    if (!active) return;

    const anchorMs = performance.now();
    const timer = setInterval(() => {
      setTick({
        from: serverNowUnix,
        elapsed: Math.max(0, Math.round((performance.now() - anchorMs) / 1000)),
      });
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [serverNowUnix, active]);

  // A fresh server timestamp supersedes the last tick: those seconds were
  // counted from the previous anchor, so adding them here would double-count.
  // Falling back to 0 is what makes the first render equal `serverNowUnix`,
  // which is also what the server rendered — so hydration matches.
  return serverNowUnix + (tick.from === serverNowUnix ? tick.elapsed : 0);
}
