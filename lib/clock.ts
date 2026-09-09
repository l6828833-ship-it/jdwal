/**
 * Derived match clock.
 *
 * Footballdata.io exposes no match minute on any endpoint, so the elapsed
 * minute is computed from kickoff. It is an ESTIMATE and is only ever used for
 * the minute indicator — scores always come from the API and are never derived.
 *
 * Living in its own pure module means the client can re-derive the minute on a
 * local timer between polls, so the clock ticks without spending quota.
 */

import type { MatchStatus } from "./types";

/** Half-time window on the derived clock. */
export const HALF_TIME_START = 45;
export const HALF_TIME_END = 60;

/**
 * A match cannot still be in progress this long after kickoff, even with extra
 * time and penalties. Past this point a fixture the provider still reports as
 * "incomplete" is treated as finished rather than left with a running clock.
 */
export const MAX_MATCH_WINDOW_MINUTES = 170;

/**
 * How far the provider's minute may lag the playing time since kickoff before
 * its clock is treated as STOPPED rather than merely a little behind.
 *
 * A running match's minute tracks wall time fairly closely, so a large gap is
 * evidence the feed has frozen, not that the match is unusual. The threshold has
 * to leave room for the legitimate reasons a real match runs behind its kickoff
 * timestamp — a delayed start, a long injury stoppage, a lengthened interval —
 * while still catching a value that has stopped moving. 20 minutes covers those
 * and, deliberately, also catches a penalty shootout: the provider holds the
 * minute at 120 while the clock is genuinely stopped, which is precisely when
 * advancing it would be wrong.
 */
const STALE_MINUTE_TOLERANCE = 20;

export interface DerivedClock {
  minute: number | null;
  isHalfTime: boolean;
  /** Raw wall-clock minutes since kickoff, including the half-time interval. */
  elapsed: number;
}

/**
 * The live minute to display, given whatever the provider told us.
 *
 * Two cases, and getting them mixed up is what made the old clock wrong:
 *
 *  • The provider reported a real minute (API-Football's `status.elapsed`).
 *    That number is authoritative but was captured when the payload was built,
 *    so it is advanced by the wall-clock time since — which keeps it ticking
 *    between polls without spending a request, and stays correct for a late
 *    kickoff or a long stoppage. Deriving from kickoff instead would throw the
 *    real value away and reintroduce exactly those errors.
 *
 *  • The provider has no clock at all (Footballdata.io). Then, and only then,
 *    the minute is ESTIMATED from kickoff.
 *
 * At half time the clock is stopped, so it must not advance.
 *
 * @param reportedAtUnix Server time the match data was normalized — NOT the
 *   locally ticking "now", which would make the minute race away.
 * @param nowUnix Must be measured against the SAME clock as `reportedAtUnix`,
 *   AND that clock must be real UTC, because `kickoffUnix` is. The difference is
 *   read as elapsed time, so any `Date.now()` from a machine whose system time is
 *   wrong measures the skew instead and pins the minute to the cap below. Both
 *   values originate from lib/true-time.ts, which resolves UTC from the network;
 *   clients tick it forward with `useServerNow`, monotonically. Note that
 *   "server time" alone is not sufficient — in local development the server is
 *   the same machine as the browser, so a broken clock is simply shared.
 */
export function liveClock(
  match: { minute: number | null; isHalfTime: boolean; kickoffUnix: number },
  reportedAtUnix: number,
  nowUnix: number,
): DerivedClock {
  const elapsed = Math.floor((nowUnix - match.kickoffUnix) / 60);

  if (match.isHalfTime) {
    return {
      minute: match.minute ?? HALF_TIME_START,
      isHalfTime: true,
      elapsed,
    };
  }

  if (match.minute == null) return deriveClock(match.kickoffUnix, nowUnix);

  /**
   * Extrapolate ONLY while the provider's own clock is keeping up with wall
   * time. Two ways it demonstrably is not:
   *
   *  • Its minute has fallen far behind the playing time that has actually
   *    passed since kickoff. Sources do freeze a row and leave it: 365scores was
   *    observed reporting "30'" on a fixture 161 minutes past kickoff, and "1'"
   *    on one 131 minutes past. A number that stopped moving two hours ago is
   *    not a number to build on.
   *  • Wall time is past the point any match can still be in progress at all
   *    (see the stale-live guard in lib/selfhosted.ts).
   *
   * In both cases the provider's figure is reported UNCHANGED rather than
   * advanced. Advancing a value that is never going to be corrected only walks
   * it up to the cap below — which is exactly how a stale row rendered as
   * "130'". Not extrapolating keeps the display honest: it shows what the source
   * last said, not a guess stacked on top of a value already known to be wrong.
   * The cost is that such a row stops ticking between polls, which is the
   * correct behaviour for a clock that has stopped.
   */
  const stalled =
    match.kickoffUnix > 0 &&
    (playedCeiling(elapsed) - match.minute > STALE_MINUTE_TOLERANCE ||
      elapsed > MAX_MATCH_WINDOW_MINUTES);

  if (stalled) return { minute: match.minute, isHalfTime: false, elapsed };

  const drift = Math.max(0, Math.floor((nowUnix - reportedAtUnix) / 60));

  /**
   * A match minute can never exceed the playing time wall-clock allows: the
   * clock stops at half time and for substitutions, but it never runs fast. That
   * makes the wall-clock figure a hard ceiling on the extrapolation above, which
   * matters when the provider's minute has gone stale — advancing a frozen value
   * on faith is what would otherwise walk it up to the cap.
   *
   * Only our own extrapolation is bounded, never the provider's figure itself:
   * if it already reads above the ceiling, it is reported as-is rather than
   * silently contradicted.
   */
  const ceiling =
    match.kickoffUnix > 0
      ? Math.max(match.minute, playedCeiling(elapsed))
      : Number.POSITIVE_INFINITY;

  return {
    // 130 rather than 120: extra time plus stoppage legitimately goes past 120.
    minute: Math.min(match.minute + drift, ceiling, 130),
    isHalfTime: false,
    elapsed,
  };
}

/**
 * The highest minute that could have been PLAYED in a given wall-clock span.
 *
 * Not the same as the span itself: once a match is past half time, 15 of those
 * minutes were the interval, with the clock stopped. Counting them made the
 * ceiling roughly a quarter-hour too generous for every second-half match, and a
 * ceiling that loose is what let a stale minute keep climbing.
 */
function playedCeiling(elapsed: number): number {
  if (elapsed < HALF_TIME_END) return elapsed;
  return elapsed - (HALF_TIME_END - HALF_TIME_START);
}

export function deriveClock(kickoffUnix: number, nowUnix: number): DerivedClock {
  const elapsed = Math.floor((nowUnix - kickoffUnix) / 60);

  if (elapsed < 0) return { minute: null, isHalfTime: false, elapsed };

  if (elapsed >= HALF_TIME_START && elapsed < HALF_TIME_END) {
    return { minute: HALF_TIME_START, isHalfTime: true, elapsed };
  }

  if (elapsed >= HALF_TIME_END) {
    // Subtract the 15-minute interval so the second half reads 46'..90'+.
    const minute = Math.min(elapsed - (HALF_TIME_END - HALF_TIME_START), 120);
    return { minute, isHalfTime: false, elapsed };
  }

  return { minute: Math.max(elapsed, 1), isHalfTime: false, elapsed };
}

export function statusLabelAr(
  status: MatchStatus,
  minute: number | null,
  isHalfTime: boolean,
): string {
  switch (status) {
    case "live":
      if (isHalfTime) return "بين الشوطين";
      return minute != null ? `${minute}'` : "مباشر";
    case "finished":
      return "انتهت";
    case "postponed":
      return "مؤجلة";
    case "cancelled":
      return "ملغاة";
    case "scheduled":
      return "لم تبدأ";
    default:
      return "—";
  }
}
