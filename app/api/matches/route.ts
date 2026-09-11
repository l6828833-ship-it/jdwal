import type { NextRequest } from "next/server";
import { getMatchesByDate } from "@/lib/provider";
import { BudgetExhaustedError } from "@/lib/cache";
import { logFailure } from "@/lib/errors";
import { isValidDateKey, dateKeyDiff } from "@/lib/date";
import { resolveRequestTime } from "@/lib/geo-timezone";
import { DATE_RANGE_DAYS, LIVE_CACHE_CONTROL } from "@/lib/config";
import type { MatchesPayload } from "@/lib/types";

/**
 * Matches for one calendar day, including live status.
 *
 * The client polls this on the live interval. Upstream traffic is bounded by
 * lib/cache.ts, so every browser polling shares the same cached response and
 * the API key is never called once per client.
 *
 * The API key stays server-side; it is never shipped to the browser.
 */
export async function GET(request: NextRequest) {
  // "Today" must be computed in the SAME zone the client's date selector uses
  // (the IP-resolved zone) and off the SAME trusted clock, or the two disagree
  // by a day and the range check below wrongly rejects dates the user can still
  // navigate to — which showed up as an empty screen when paging a couple of
  // days ahead. See resolveRequestTime.
  const { today, timezone, source, hostClockOffsetSeconds } =
    await resolveRequestTime();
  const requested = request.nextUrl.searchParams.get("date") ?? today;

  if (!isValidDateKey(requested)) {
    return Response.json(
      { error: "Invalid date. Expected YYYY-MM-DD." },
      { status: 400 },
    );
  }

  // Bound how far the date arrows can reach so crawlers can't walk the
  // calendar and drain the monthly quota. A one-day grace beyond the selector's
  // range absorbs any timezone drift between the client's "today" and the
  // server's, so a date the user can legitimately reach is never rejected.
  const offset = dateKeyDiff(today, requested);
  if (Math.abs(offset) > DATE_RANGE_DAYS + 1) {
    return Response.json(
      { error: `Date out of range (±${DATE_RANGE_DAYS} days).` },
      { status: 400 },
    );
  }

  // Background polls carry ?bg=1 so the budget guard can cut them before it
  // ever blocks a request a user is actively waiting on.
  const background = request.nextUrl.searchParams.get("bg") === "1";

  try {
    const { matches, meta, nowUnix } = await getMatchesByDate(
      requested,
      today,
      background,
    );
    const payload: MatchesPayload = { date: requested, matches, meta, nowUnix };

    return Response.json(payload, {
      headers: {
        // Allow a shared CDN/proxy layer to absorb repeat polls too.
        "Cache-Control": LIVE_CACHE_CONTROL,
        /**
         * Key the shared cache on the `date` query param.
         *
         * Netlify's edge varies only on its own Next.js params by default, so
         * every date collided into ONE cache entry: a request for any day was
         * served whichever day happened to be cached first. The client then saw
         * `payload.date` never match the day it asked for and sat on "loading"
         * forever. Varying on `date` gives each day its own entry.
         */
        "Netlify-Vary": "query=date",
        // Same intent for any other standards-compliant CDN in front of this.
        Vary: "Accept-Encoding",
        /**
         * Diagnostic: how many seconds the SERVER's own system clock is out by,
         * as measured against the network (lib/true-time.ts). `0` means the host
         * is correctly synced; anything large means the correction is carrying
         * the app and the machine's clock should be fixed. Without this the
         * condition is invisible — it only shows up as strange match minutes.
         */
        "X-Host-Clock-Offset": String(hostClockOffsetSeconds ?? "unknown"),
        /**
         * Diagnostic: the zone times are rendered in, and which source gave it.
         * Anything but `fallback` came from the visitor's connection; `fallback`
         * means none of them answered and the configured default is standing in.
         * The device is never a source — see components/timezone-provider.tsx.
         */
        "X-Timezone": timezone,
        "X-Timezone-Source": source,
      },
    });
  } catch (error) {
    if (error instanceof BudgetExhaustedError) {
      // `code` is the contract the client reads; the message is not forwarded.
      return Response.json(
        { error: "budget_exhausted", code: "budget_exhausted" },
        { status: 503 },
      );
    }
    // The message is NOT forwarded. It names the backend and quotes its URL,
    // and this response is readable by anyone; the detail goes to the log.
    logFailure("api/matches", error);
    return Response.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
