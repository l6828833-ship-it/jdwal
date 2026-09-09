import type { NextRequest } from "next/server";
import { getMatchesByDate } from "@/lib/provider";
import { BudgetExhaustedError } from "@/lib/cache";
import { isValidDateKey, todayKey, dateKeyDiff } from "@/lib/date";
import { resolveTimezoneFromRequest } from "@/lib/geo-timezone";
import { DATE_RANGE_DAYS, LIVE_POLL_SECONDS } from "@/lib/config";
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
  // (the IP-resolved zone), or the two disagree by a day and the range check
  // below wrongly rejects dates the user can still navigate to — which showed
  // up as an empty screen when paging a couple of days ahead.
  const { timezone } = await resolveTimezoneFromRequest();
  const today = todayKey(timezone);
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
        "Cache-Control": `public, s-maxage=${LIVE_POLL_SECONDS}, stale-while-revalidate=${LIVE_POLL_SECONDS * 4}`,
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
      },
    });
  } catch (error) {
    if (error instanceof BudgetExhaustedError) {
      return Response.json({ error: error.message, code: "budget_exhausted" }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
