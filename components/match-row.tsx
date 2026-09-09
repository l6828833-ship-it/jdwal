"use client";

import { NavLink } from "@/components/nav-link";
import { Crest, Flag } from "./crest";
import { LiveBadge } from "./live-badge";
import { useTimezone } from "./timezone-provider";
import { useMinuteAnchor } from "./use-minute-anchor";
import { formatKickoff } from "@/lib/date";
import { liveClock } from "@/lib/clock";
import { t } from "@/lib/i18n";
import type { Match } from "@/lib/types";

interface MatchRowProps {
  match: Match;
  /**
   * Current time in unix seconds, on the SERVER's clock — from `useServerNow`,
   * never `Date.now()`. When provided, the live minute advances locally so the
   * clock keeps ticking between polls without extra requests.
   */
  nowUnix?: number;
  /**
   * Server time the match data was normalized. Used to date the provider's
   * reported minute, so `liveClock` knows how far to advance it.
   */
  reportedAtUnix?: number;
}

/**
 * One fixture row.
 *
 * Layout stability rules (polling re-renders this every interval):
 *  • the centre cell has a fixed width and height, so "19:00" -> "2 - 1" plus a
 *    live badge cannot change the row's geometry;
 *  • all numerals use tabular figures, so 9 -> 10 does not re-flow;
 *  • home and away scores are separate elements rather than one "2 - 1" string,
 *    so the bidi algorithm can't reorder them in the RTL container.
 */
export function MatchRow({ match, nowUnix, reportedAtUnix }: MatchRowProps) {
  const timezone = useTimezone();
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScore = isLive || isFinished;

  // Dates the provider's minute by when it was FIRST seen, so the clock keeps
  // ticking between the provider's own updates instead of mirroring them.
  const minuteAt = useMinuteAnchor(
    match.minute,
    match.isHalfTime,
    reportedAtUnix ?? nowUnix ?? 0,
  );

  const clock =
    isLive && nowUnix != null
      ? liveClock(match, minuteAt, nowUnix)
      : { minute: match.minute, isHalfTime: match.isHalfTime };

  return (
    <li className="border-b border-divider last:border-b-0">
      <NavLink
        href={`/match/${match.id}`}
        aria-label={`${match.home.name} ${t.vs} ${match.away.name}`}
        className="flex items-center gap-2 px-3 py-3 transition-colors hover:bg-surface-hover active:bg-surface-hover sm:px-4"
      >
        {/* Home side — first child sits on the right in RTL. */}
        <TeamSide
          name={match.home.name}
          logo={match.home.logo}
          countryCode={match.home.countryCode}
          align="start"
        />

        {/* Fixed-size centre cell: the only part that changes while polling. */}
        <div className="flex h-11 w-[5.25rem] shrink-0 flex-col items-center justify-center gap-0.5">
          {showScore ? (
            <>
              <div
                className={`flex items-center gap-1.5 text-base font-bold tnum ${
                  isLive ? "text-live" : "text-foreground"
                }`}
              >
                {match.score.confirmed ? (
                  <>
                    <span>{match.score.home ?? 0}</span>
                    <span className="text-muted-dim">-</span>
                    <span>{match.score.away ?? 0}</span>
                  </>
                ) : (
                  // Provider hasn't published the score; show nothing rather
                  // than its unpopulated 0-0.
                  <span className="text-muted-dim">–</span>
                )}
              </div>
              {isLive ? (
                <LiveBadge minute={clock.minute} isHalfTime={clock.isHalfTime} />
              ) : (
                <span
                  title={match.score.confirmed ? undefined : t.awaitingResult}
                  className="whitespace-nowrap text-[0.65rem] font-medium text-muted-dim"
                >
                  {match.score.confirmed ? t.finished : t.awaitingResultShort}
                </span>
              )}
            </>
          ) : (
            <>
              <span dir="ltr" className="text-sm font-semibold text-foreground tnum">
                {formatKickoff(match.kickoffUnix, timezone)}
              </span>
              {match.status === "postponed" || match.status === "cancelled" ? (
                <span className="text-[0.65rem] font-medium text-muted-dim">
                  {match.statusLabel}
                </span>
              ) : null}
            </>
          )}
        </div>

        <TeamSide
          name={match.away.name}
          logo={match.away.logo}
          countryCode={match.away.countryCode}
          align="end"
        />
      </NavLink>
    </li>
  );
}

interface TeamSideProps {
  name: string;
  logo: string | null;
  countryCode: string | null;
  align: "start" | "end";
}

function TeamSide({ name, logo, countryCode, align }: TeamSideProps) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === "start" ? "justify-start" : "flex-row-reverse justify-start"
      }`}
    >
      <Crest src={logo} name={name} size={26} />
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <Flag code={countryCode} />
      </span>
    </div>
  );
}
