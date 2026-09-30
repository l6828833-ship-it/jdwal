import { NextResponse } from "next/server";

/** TEMPORARY — dump raw standings ranks to see what the table renders from. */
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
    const body = (await res.json()) as { standings?: unknown[][] };
    const tables = Array.isArray(body?.standings) ? body.standings : [];

    // Flatten exactly like the normalizer does, capturing rank + group.
    const flat: Array<{ rank: unknown; group: unknown; desc: unknown }> = [];
    for (const table of tables) {
      for (const r of Array.isArray(table) ? table : []) {
        const row = r as {
          rank?: unknown;
          group?: unknown;
          description?: unknown;
        };
        flat.push({ rank: row.rank, group: row.group, desc: row.description });
      }
    }

    const ranks = flat.map((r) => r.rank);
    const seen = new Set<unknown>();
    let firstDup: unknown = null;
    for (const r of ranks) {
      if (seen.has(r)) {
        firstDup = r;
        break;
      }
      seen.add(r);
    }

    return NextResponse.json({
      tableCount: tables.length,
      rowCount: flat.length,
      allRanks: ranks,
      firstDuplicateRank: firstDup,
      anyGroupLabel: flat.some((r) => r.group),
      sampleGroups: flat.slice(0, 6).map((r) => r.group),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
