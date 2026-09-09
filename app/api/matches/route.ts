import type { NextRequest } from "next/server";
import { getMatchesByDate } from "@/lib/provider";
import { BudgetExhaustedError } from "@/lib/cache";
import { isValidDateKey, todayKey, dateKeyDiff } from "@/lib/date";
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
  const today = todayKey();
  const requested = request.nextUrl.searchParams.get("date") ?? today;

  if (!isValidDateKey(requested)) {
    return Response.json(
      { error: "Invalid date. Expected YYYY-MM-DD." },
      { status: 400 },
    );
  }

  // Bound how far the date arrows can reach so crawlers can't walk the
  // calendar and drain the monthly quota.
  const offset = dateKeyDiff(today, requested);
  if (Math.abs(offset) > DATE_RANGE_DAYS) {
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
