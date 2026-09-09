"use client";

import { useState } from "react";

/**
 * When the provider's CURRENT minute for a match was first seen.
 *
 * `liveClock` advances the provider's minute by the time elapsed since it was
 * reported, which is what makes the clock tick between polls. Anchoring that to
 * "when this payload was assembled" defeats it entirely: the client re-polls
 * every LIVE_POLL_SECONDS (20s here), so the anchor jumps forward long before a
 * whole minute of drift can accumulate. `floor(20s / 60)` is 0, every time — so
 * the displayed minute was a pure mirror of the provider's own value and only
 * moved when the provider moved it, in jumps, or not at all while the upstream
 * feed lagged.
 *
 * Anchoring to the first sighting of the VALUE instead lets drift accumulate
 * across polls: the minute ticks once per real minute on its own, and snaps back
 * to the provider's number the moment that number changes. The provider stays
 * authoritative; this only fills the gaps between its updates.
 *
 * Half time is tracked alongside the minute because the clock stops there —
 * coming out of the break is a change worth re-anchoring on even when the
 * minute itself reads the same.
 *
 * @param reportedAtUnix Server time the current payload was normalized.
 * @returns The server time to treat the minute as having been reported at.
 */
export function useMinuteAnchor(
  minute: number | null,
  isHalfTime: boolean,
  reportedAtUnix: number,
): number {
  const [anchor, setAnchor] = useState({ minute, isHalfTime, atUnix: reportedAtUnix });

  if (anchor.minute !== minute || anchor.isHalfTime !== isHalfTime) {
    // Adjusting state during render: React discards this pass and re-runs
    // immediately, so no extra commit and no effect round-trip.
    setAnchor({ minute, isHalfTime, atUnix: reportedAtUnix });
    return reportedAtUnix;
  }

  return anchor.atUnix;
}
