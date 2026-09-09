import { getLeagueFixtures } from "@/lib/provider";

/**
 * A competition's matches, polled by the league page so scores and the live
 * clock refresh without a reload. Returns the normalized matches plus the
 * server time they were built against (which seeds the client clock).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const leagueId = Number(id);
  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    return Response.json({ error: "Invalid league id" }, { status: 400 });
  }

  try {
    const { matches, isCup, nowUnix } = await getLeagueFixtures(leagueId);
    return Response.json({ matches, isCup, nowUnix });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}
