"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MatchRow } from "./match-row";
import { useServerNow } from "./use-server-now";
import { LIVE_POLL_SECONDS } from "@/lib/config";
import { t } from "@/lib/i18n";
import type { Match } from "@/lib/types";

interface LeagueMatchesProps {
  leagueId: number;
  initialMatches: Match[];
  initialNowUnix: number;
  /** A cup shows a bracket elsewhere; here it only lists matches by round. */
  isCup: boolean;
}

/**
 * A competition's matches: recent results and upcoming fixtures.
 *
 * Auto-refreshes while anything is live so scores and the clock update without
 * a reload, reusing the same fixed-poll cadence as the home page. The list is
 * split around "now": finished/live above, scheduled below.
 */
export function LeagueMatches({
  leagueId,
  initialMatches,
  initialNowUnix,
  isCup,
}: LeagueMatchesProps) {
  const [matches, setMatches] = useState(initialMatches);
  /** Server time the current `matches` were normalized at. */
  const [reportedAtUnix, setReportedAtUnix] = useState(initialNowUnix);
  const seq = useRef(0);

  const liveCount = matches.filter((m) => m.status === "live").length;

  // Server-anchored, monotonic: never the device clock. See useServerNow.
  const nowUnix = useServerNow(reportedAtUnix, liveCount > 0);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    try {
      const res = await fetch(`/api/league/${leagueId}/matches`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const body = (await res.json()) as { matches?: Match[]; nowUnix?: number };
      if (id !== seq.current) return;
      if (body.matches) {
        setMatches(body.matches);
        if (body.nowUnix) setReportedAtUnix(body.nowUnix);
      }
    } catch {
      // Keep the current data on a failed refresh.
    }
  }, [leagueId]);

  // Poll while a match is live; pause when the tab is hidden.
  useEffect(() => {
    if (liveCount === 0) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => void refresh(), LIVE_POLL_SECONDS * 1000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else stop();
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [liveCount, refresh]);

  const recent = matches
    .filter((m) => m.status === "finished" || m.status === "live")
    .sort((a, b) => b.kickoffUnix - a.kickoffUnix);
  const upcoming = matches
    .filter((m) => m.status !== "finished" && m.status !== "live")
    .sort((a, b) => a.kickoffUnix - b.kickoffUnix);

  return (
    <div className="flex flex-col gap-4">
      <Section
        title={isCup ? t.results : t.recentResults}
        matches={recent}
        empty={t.noRecent}
        nowUnix={nowUnix}
        reportedAtUnix={reportedAtUnix}
      />
      <Section
        title={t.upcomingFixtures}
        matches={upcoming}
        empty={t.noUpcoming}
        nowUnix={nowUnix}
        reportedAtUnix={reportedAtUnix}
      />
    </div>
  );
}

function Section({
  title,
  matches,
  empty,
  nowUnix,
  reportedAtUnix,
}: {
  title: string;
  matches: Match[];
  empty: string;
  nowUnix: number;
  reportedAtUnix: number;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-semibold text-foreground">{title}</h2>
      {matches.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          {empty}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border bg-surface">
          {matches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              nowUnix={nowUnix}
              reportedAtUnix={reportedAtUnix}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
