import { MatchesView } from "@/components/matches-view";
import { getMatchesByDate, hasApiKey } from "@/lib/provider";
import { todayKey } from "@/lib/date";
import { resolveTimezoneFromRequest } from "@/lib/geo-timezone";
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

  // "Today" must mean today where the VIEWER is, not where the server runs.
  // Resolve the same IP-based zone the app displays times in, so the date the
  // header shows and the fixtures fetched match the user's actual day.
  const { timezone } = await resolveTimezoneFromRequest();
  const today = todayKey(timezone);

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
