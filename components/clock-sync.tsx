"use client";

import { seedTrueTime } from "@/lib/true-time";

/**
 * Hands the browser the server's already-corrected time.
 *
 * The server resolves real UTC from the network (lib/true-time.ts). This carries
 * that value across the boundary so `nowUnix()` means the same thing on the
 * client, and the DEVICE clock is never read — which is the whole point on a
 * machine whose own time is wrong. Once seeded, the value advances on
 * `performance.now()`, a monotonic counter the system clock cannot move, so a
 * mid-session NTP correction or a manual date change cannot jolt it.
 *
 * Rendered as a component rather than a hook so it sits in the root layout and
 * runs before the tree below it, and so the seed happens during the FIRST render
 * pass — an effect would run after paint, leaving that pass on the device clock.
 * It renders nothing and holds no state, so it can never trigger a re-render.
 *
 * Note this is a floor, not the whole mechanism: live match rows get a fresher
 * timestamp with every poll and tick it forward themselves (see
 * components/use-server-now.ts). This makes any OTHER client-side "now" — a date
 * key, a "has it kicked off yet" check — correct by default too.
 */
export function ClockSync({ serverNowUnix }: { serverNowUnix: number }) {
  // Idempotent and side-effect-free as far as React is concerned: it writes to a
  // module-level anchor, never to state, and ignores a value it already agrees
  // with, so re-renders and Strict Mode's double invocation are both harmless.
  seedTrueTime(serverNowUnix);
  return null;
}
