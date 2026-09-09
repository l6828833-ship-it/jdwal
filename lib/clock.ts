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

  const drift = Math.max(0, Math.floor((nowUnix - reportedAtUnix) / 60));
  return {
    // 130 rather than 120: extra time plus stoppage legitimately goes past 120.
    minute: Math.min(match.minute + drift, 130),
    isHalfTime: false,
    elapsed,
  };
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
