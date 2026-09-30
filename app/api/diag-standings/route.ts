import { NextResponse } from "next/server";

/**
 * TEMPORARY diagnostic — inspect the raw standings shape the backend returns
 * for a competition, so grouping bugs can be diagnosed against real data
 * instead of assumptions. Remove after use.
 *
 *   /api/_diag-standings?league=862144&season=2026
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const league = url.searchParams.get("league") ?? "862144";
  const season = url.searchParams.get("season") ?? "2026";
  const base = (process.env.SELFHOSTED_BASE_URL || "http://localhost:4000").replace(
    /\/+$/,
    "",
  );

  try {
    const upstream = new URL(`${base}/standings/getStandings`);
    upstream.searchParams.set("league", league);
    upstream.searchParams.set("season", season);
    const res = await fetch(upstream, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json()) as {
      standings?: unknown[][];
      league?: { name?: string };
    };

    const tables = Array.isArray(body?.standings) ? body.standings : [];
    const summary = tables.map((table, i) => {
      const rows = Array.isArray(table) ? table : [];
      return {
        tableIndex: i,
        rowCount: rows.length,
        sampleRows: rows.slice(0, 3).map((r) => {
          const row = r as {
            rank?: number;
            group?: string | null;
            description?: string | null;
            team?: { name?: string };
          };
          return {
            rank: row.rank,
            group: row.group ?? null,
            description: row.description ?? null,
            team: row.team?.name,
          };
        }),
      };
    });

    return NextResponse.json({
      httpStatus: res.status,
      league: body?.league?.name,
      tableCount: tables.length,
      diagnosis:
        tables.length > 1
          ? "MULTIPLE sub-arrays — index-based grouping should trigger"
          : tables.length === 1
            ? "SINGLE flat sub-array — groups are inside one table; must split on row.group/description"
            : "no standings array",
      tables: summary,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
