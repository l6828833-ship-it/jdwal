import { getMatchDetail, isPlanGatedError } from "@/lib/provider";
import { BudgetExhaustedError } from "@/lib/cache";
import { LIVE_CACHE_CONTROL } from "@/lib/config";
import { logFailure } from "@/lib/errors";

/**
 * One match, including stats. Polled by the detail page on the same interval as
 * the home page. Upstream traffic stays bounded by the shared cache.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/match/[id]">,
) {
  const { id } = await context.params;
  const matchId = Number(id);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return Response.json({ error: "Invalid match id." }, { status: 400 });
  }

  try {
    const result = await getMatchDetail(matchId);
    if (!result) {
      return Response.json({ error: "Match not found." }, { status: 404 });
    }

    return Response.json(result, {
      headers: {
        "Cache-Control": LIVE_CACHE_CONTROL,
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
    if (isPlanGatedError(error)) {
      return Response.json(
        { error: "Competition not included in the current plan.", code: "not_available_on_plan" },
        { status: 403 },
      );
    }
    // The message is NOT forwarded. It names the backend and quotes its URL,
    // and this response is readable by anyone; the detail goes to the log.
    logFailure(`api/match/${matchId}`, error);
    return Response.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
