import type { NextRequest } from "next/server";
import { logFailure } from "@/lib/errors";
import { searchPlayers } from "@/lib/provider";

/** Player name search. Debounced client calls hit this; results cache a day. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return Response.json({ players: [] });
  }

  try {
    const { players, available } = await searchPlayers(query);
    // `available: false` says the backend has no player directory, which is a
    // different answer from "found nobody" and is surfaced as such.
    return Response.json({ players, available });
  } catch (error) {
    // The message is NOT forwarded. It names the backend and quotes its URL,
    // and this response is readable by anyone; the detail goes to the log.
    logFailure("api/players", error);
    return Response.json({ error: "upstream_unavailable" }, { status: 502 });
  }
}
