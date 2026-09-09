import { MatchesView } from "@/components/matches-view";
import { getMatchesByDate, hasApiKey } from "@/lib/provider";
import { resolveRequestTime } from "@/lib/geo-timezone";
import { ApiKeyNotice, LoadErrorNotice, QuotaNotice } from "@/components/notices";
import type { MatchesPayload } from "@/lib/types";

/**
 * Rendered per request: the fixture list changes through the day and while
 * matches are in progress. Upstream traffic is still bounded by the shared
 * cache in lib/cache.ts, so dynamic rendering does not mean a request per view.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!hasApiKey()) {
    return <ApiKeyNotice />;
  }

  /**
   * "Today" must mean today where the VIEWER is, not where the server runs —
   * and it must be the real today, not whatever the host machine's clock says.
   *
   * `resolveRequestTime` settles both from the network: the zone from the
   * visitor's IP, the clock from an external authority (lib/true-time.ts). It
   * has to be one call, because a correct zone applied to a wrong clock still
   * lands on the wrong date, and then the whole page is a different day's
   * fixtures.
   */
  const { today } = await resolveRequestTime();

  let payload: MatchesPayload;
  try {
    const { matches, meta, nowUnix } = await getMatchesByDate(today, today);
    payload = { date: today, matches, meta, nowUnix };
  } catch (error) {
    if (error instanceof Error && /budget/i.test(error.message)) {
      return <QuotaNotice />;
    }
    return (
      <LoadErrorNotice
        message={error instanceof Error ? error.message : String(error)}
      />
    );
  }

  return <MatchesView initialPayload={payload} />;
}
