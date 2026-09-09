/**
 * Trusted wall clock.
 *
 * Every time this app displays is derived from a "now": the live match minute,
 * which day "today" is, whether a fixture has kicked off, how stale a cache
 * entry is. All of that used to come from `Date.now()`, which reads the HOST's
 * system clock and is therefore only as correct as that machine happens to be.
 *
 * That assumption fails hard in local development, because there the browser,
 * the Next.js server and the self-hosted backend are all the SAME machine. A
 * laptop running ~8 hours fast made every live match read "130'" — the display
 * cap in lib/clock.ts — because the gap between a real kickoff timestamp from
 * the provider and a skewed local "now" was read as elapsed time. Anchoring the
 * client to "server time" (see components/use-server-now.ts) cannot fix that:
 * the server IS the broken machine, so both clocks are wrong together and agree
 * with each other perfectly.
 *
 * So the time is taken from the NETWORK instead, over the same connection the
 * visitor's timezone is resolved from. Two properties make it reliable:
 *
 *   1. It is anchored ONCE against an external authority, which fixes the
 *      offset from the host clock.
 *   2. It advances on a MONOTONIC timer (`performance.now()`, counted from the
 *      process/page time origin and not derived from the system clock), so
 *      reading it afterwards costs nothing and an NTP correction or a manual
 *      date change mid-session cannot move it. That last part matters even on a
 *      correctly-configured server: a clock that jumps mid-session would
 *      otherwise make elapsed-time arithmetic jump with it.
 *
 * On a properly NTP-synced host the measured offset is ~0 and nothing changes,
 * which is the point — this is a correction, not a dependency. If the network
 * lookup fails the host clock is used exactly as before, so a time source is
 * never something a render can block on or fail over.
 *
 * Isomorphic on purpose: the server syncs from the network, and the client is
 * seeded with the server's already-corrected time by `<ClockSync>`, so
 * `nowUnix()` means the same thing on both sides and the device clock is never
 * consulted anywhere.
 */

/** Re-check the offset this often. Clock drift is slow; this is ample. */
const RESYNC_INTERVAL_MS = 10 * 60 * 1000;

/**
 * After a failed lookup, wait this long before trying again.
 *
 * Without it an offline or firewalled host would attempt a lookup on every
 * single request and pay the timeout each time — turning a missing time source
 * into a latency problem on every page.
 */
const RETRY_BACKOFF_MS = 30 * 1000;

/** A time lookup must never hold up a render for longer than this. */
const REQUEST_TIMEOUT_MS = 2_500;

/**
 * Ignore a round trip slower than this rather than anchor to it.
 *
 * The anchor assumes the remote timestamp was generated at the midpoint of the
 * request, which is only a good assumption while the round trip is short. A
 * multi-second one says nothing useful about the current instant.
 */
const MAX_ACCEPTABLE_RTT_MS = 2_000;

/** Sanity window: reject a reading outside this, e.g. an HTML error page. */
const MIN_PLAUSIBLE_MS = Date.UTC(2020, 0, 1);
const MAX_PLAUSIBLE_MS = Date.UTC(2100, 0, 1);

/**
 * Where the true time is read from, tried in order until one answers.
 *
 * `cdn-cgi/trace` is first because Cloudflare's edge terminates the visitor's
 * own connection and answers with `ts=<unix seconds>` at sub-second precision,
 * plus `loc=<country>` — the same IP-derived vantage point the timezone is
 * resolved from, so time and place come from one place and agree.
 *
 * The rest are read from the HTTP `Date` response header, which RFC 9110
 * requires of essentially every origin. That is only second-granular, so it is
 * the fallback rather than the primary, but it needs no API, no key and no
 * quota, and it is available from any reachable host.
 *
 * `TRUE_TIME_URL` prepends a custom source (an internal NTP-backed endpoint, a
 * paid time API) without touching this list.
 */
const TIME_SOURCES: readonly string[] = [
  ...(process.env.TRUE_TIME_URL ? [process.env.TRUE_TIME_URL] : []),
  "https://cloudflare.com/cdn-cgi/trace",
  "https://www.google.com/generate_204",
  "https://one.one.one.one/cdn-cgi/trace",
];

export interface ClockAnchor {
  /** True UTC in ms at the moment the anchor was taken. */
  trueMs: number;
  /** The monotonic reading paired with `trueMs`. */
  monoMs: number;
  /** Which source answered, or "host" / "server" when not from the network. */
  source: string;
  /** Half the round trip: how far off `trueMs` could plausibly be, in ms. */
  uncertaintyMs: number;
  /** `trueMs - Date.now()` at anchor time: the host clock's error. */
  offsetMs: number;
}

interface ClockState {
  anchor: ClockAnchor | null;
  inFlight: Promise<ClockAnchor | null> | null;
  /** Monotonic reading of the last failed attempt, for the retry backoff. */
  failedAtMonoMs: number;
}

/**
 * Held on `globalThis` so a dev-server hot reload does not discard the anchor
 * and re-run the lookup on every file save.
 */
const globalClock = globalThis as typeof globalThis & {
  __jadwelClock?: ClockState;
};

function state(): ClockState {
  globalClock.__jadwelClock ??= {
    anchor: null,
    inFlight: null,
    failedAtMonoMs: Number.NEGATIVE_INFINITY,
  };
  return globalClock.__jadwelClock;
}

/**
 * A steadily increasing millisecond count that the system clock cannot move.
 *
 * `performance.now()` is measured from the process (or page) time origin, so it
 * keeps counting real elapsed time through a clock correction, a timezone
 * change or a manual date edit — which is exactly what wall-clock arithmetic
 * must not be exposed to.
 */
function monoMs(): number {
  return performance.now();
}

/** Set when the operator would rather trust the host clock than the network. */
function disabled(): boolean {
  return process.env.TRUE_TIME === "off";
}

/**
 * True UTC in milliseconds.
 *
 * Synchronous and free: it projects the stored anchor forward on the monotonic
 * timer, so it can be called as freely as `Date.now()` — which it falls back to
 * when no anchor has been established.
 */
export function nowMs(): number {
  const { anchor } = state();
  if (!anchor) return Date.now();
  return Math.round(anchor.trueMs + (monoMs() - anchor.monoMs));
}

/** True UTC in whole seconds — the unit every match timestamp uses. */
export function nowUnix(): number {
  return Math.floor(nowMs() / 1000);
}

/** True UTC as a `Date`, for the `Intl` formatters in lib/date.ts. */
export function nowDate(): Date {
  return new Date(nowMs());
}

/**
 * How wrong the host's system clock is, in seconds, or null if not yet known.
 *
 * Recomputed on read rather than reusing the anchor's value, so it reflects a
 * clock that has been corrected (or broken) since the anchor was taken.
 * Surfaced in API responses so a bad host clock is diagnosable instead of just
 * producing strange minutes.
 */
export function hostClockOffsetSeconds(): number | null {
  const { anchor } = state();
  if (!anchor) return null;
  return Math.round((nowMs() - Date.now()) / 1000);
}

/** The current anchor, for diagnostics. */
export function clockAnchor(): ClockAnchor | null {
  return state().anchor;
}

/**
 * Make sure a trusted time is available, then return.
 *
 * Awaited by the server entry points that need a correct "today" before they
 * render (see `resolveRequestTime` in lib/geo-timezone.ts). The cost is paid at
 * most once per process per `RESYNC_INTERVAL_MS`:
 *
 *   • anchor still fresh   → returns immediately, no I/O
 *   • anchor gone stale    → returns immediately and refreshes in the
 *                            BACKGROUND, so no request waits on a re-sync
 *   • no anchor at all     → awaits the lookup, because rendering with the
 *                            host clock is the very thing being fixed. Bounded
 *                            by REQUEST_TIMEOUT_MS, and a recent failure is
 *                            remembered so an unreachable source does not add
 *                            that timeout to every request.
 */
export async function ensureTrueTime(): Promise<void> {
  if (disabled()) return;

  const s = state();
  const age = s.anchor ? monoMs() - s.anchor.monoMs : Number.POSITIVE_INFINITY;

  if (s.anchor && age < RESYNC_INTERVAL_MS) return;

  if (s.anchor) {
    // Stale but usable: refresh without making this request wait. The floating
    // promise is deliberate; `syncTrueTime` never rejects.
    void syncTrueTime();
    return;
  }

  if (monoMs() - s.failedAtMonoMs < RETRY_BACKOFF_MS) return;

  await syncTrueTime();
}

/**
 * Measure the offset against the network and store a new anchor.
 *
 * Never rejects: a missing time source degrades to the host clock, which is the
 * behaviour this module replaces, not something that should break a render.
 * Concurrent callers share one lookup.
 */
export function syncTrueTime(): Promise<ClockAnchor | null> {
  const s = state();
  s.inFlight ??= resolveAnchor()
    .then((anchor) => {
      if (anchor) {
        s.anchor = anchor;
        s.failedAtMonoMs = Number.NEGATIVE_INFINITY;
      } else {
        s.failedAtMonoMs = monoMs();
      }
      return anchor;
    })
    .catch(() => {
      s.failedAtMonoMs = monoMs();
      return null;
    })
    .finally(() => {
      s.inFlight = null;
    });

  return s.inFlight;
}

/**
 * Adopt a time measured elsewhere — used by the client, which is handed the
 * server's already-corrected time rather than reading its own device clock.
 *
 * Kept as an anchor like any other so the value then advances monotonically,
 * instead of being re-read (and re-skewed) from `Date.now()`.
 *
 * Only overwrites a network anchor when the two disagree by more than the
 * tolerance, so repeated seeds from React renders cannot make the clock jitter.
 */
export function seedTrueTime(trueUnixSeconds: number, source = "server"): void {
  if (!Number.isFinite(trueUnixSeconds) || trueUnixSeconds <= 0) return;

  const trueMs = trueUnixSeconds * 1000;
  if (trueMs < MIN_PLAUSIBLE_MS || trueMs > MAX_PLAUSIBLE_MS) return;

  const s = state();
  const now = monoMs();

  if (s.anchor && Math.abs(nowMs() - trueMs) < 2_000) return;

  s.anchor = {
    trueMs,
    monoMs: now,
    source,
    // A payload carries no round-trip measurement; a second is a fair estimate
    // of the transfer, and a second is far below what a match minute can show.
    uncertaintyMs: 1_000,
    offsetMs: trueMs - Date.now(),
  };
}

/** Try each source in turn; the first plausible reading wins. */
async function resolveAnchor(): Promise<ClockAnchor | null> {
  for (const url of TIME_SOURCES) {
    const anchor = await readTime(url);
    if (anchor) return anchor;
  }
  return null;
}

/**
 * One time reading, corrected for the round trip.
 *
 * The remote timestamp is treated as having been generated at the MIDPOINT of
 * the request (the standard NTP assumption), so the anchor is paired with the
 * monotonic reading at that midpoint rather than at either end — otherwise the
 * whole network latency is baked into the offset as error.
 */
async function readTime(url: string): Promise<ClockAnchor | null> {
  const startMono = monoMs();
  try {
    const response = await fetch(url, {
      // A cached timestamp is a wrong timestamp: `no-store` keeps both the
      // framework cache and any HTTP cache out of the way. Passing a signal
      // also opts out of Next.js per-render fetch memoization.
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "cache-control": "no-cache" },
    });

    const endMono = monoMs();
    const rttMs = endMono - startMono;
    if (rttMs > MAX_ACCEPTABLE_RTT_MS) return null;

    // Prefer a precise body timestamp; fall back to the Date header, which
    // every origin sends but only to the second.
    const trueMs =
      (await traceTimestampMs(response)) ?? dateHeaderMs(response);
    if (trueMs == null) return null;
    if (trueMs < MIN_PLAUSIBLE_MS || trueMs > MAX_PLAUSIBLE_MS) return null;

    return {
      trueMs,
      monoMs: startMono + rttMs / 2,
      source: url,
      uncertaintyMs: Math.round(rttMs / 2),
      offsetMs: trueMs - Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * `ts=<unix seconds>` from a Cloudflare `cdn-cgi/trace` body.
 *
 * Read only for that shape of response, so a source that answers with a bare
 * 204 (`generate_204`) is not pointlessly downloaded and parsed.
 */
async function traceTimestampMs(response: Response): Promise<number | null> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/plain")) return null;
  try {
    const body = await response.text();
    const match = /^ts=([0-9]+(?:\.[0-9]+)?)$/m.exec(body);
    if (!match) return null;
    const seconds = Number(match[1]);
    return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
  } catch {
    return null;
  }
}

/**
 * The HTTP `Date` header as ms.
 *
 * The header is truncated to the second, so the instant it describes is
 * somewhere in the following second; the midpoint of that window is the best
 * single estimate and halves the worst-case error.
 */
function dateHeaderMs(response: Response): number | null {
  const header = response.headers.get("date");
  if (!header) return null;
  const parsed = Date.parse(header);
  return Number.isFinite(parsed) ? parsed + 500 : null;
}
