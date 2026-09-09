"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crest, Flag } from "./crest";
import { LiveBadge } from "./live-badge";
import { MatchStatsPanel } from "./match-stats";
import { useTimezone } from "./timezone-provider";
import { useMinuteAnchor } from "./use-minute-anchor";
import { useServerNow } from "./use-server-now";
import { liveClock } from "@/lib/clock";
import { LIVE_POLL_SECONDS } from "@/lib/config";
import { formatDateLong, formatKickoff, toDateKey } from "@/lib/date";
import { BROADCAST_REGION } from "@/lib/broadcast";
import { t } from "@/lib/i18n";
import type { MatchDetail } from "@/lib/types";

interface MatchDetailViewProps {
  initialMatch: MatchDetail;
  /** Server time the match was normalized against; seeds the local clock. */
  initialNowUnix: number;
}

type Tab = "info" | "stats";

export function MatchDetailView({
  initialMatch,
  initialNowUnix,
}: MatchDetailViewProps) {
  const router = useRouter();
  const timezone = useTimezone();
  const [match, setMatch] = useState(initialMatch);
  /** When the current `match` was normalized on the server. */
  const [reportedAtUnix, setReportedAtUnix] = useState(initialNowUnix);
  const [tab, setTab] = useState<Tab>("info");

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScore = isLive || isFinished;
  const hasStats = Boolean(match.stats?.hasAny);

  /**
   * Ticks between polls so the minute advances smoothly. Anchored to the server
   * timestamp above, NOT to the device clock — see useServerNow for why that
   * distinction is what keeps the minute correct.
   */
  const nowUnix = useServerNow(reportedAtUnix, isLive);

  // See useMinuteAnchor: dates the minute by its first sighting, not by the
  // payload, so a 20s poll cadence can't keep resetting the drift to zero.
  const minuteAt = useMinuteAnchor(match.minute, match.isHalfTime, reportedAtUnix);

  const clock = useMemo(
    () =>
      isLive
        ? liveClock(match, minuteAt, nowUnix)
        : { minute: match.minute, isHalfTime: match.isHalfTime },
    [isLive, match, minuteAt, nowUnix],
  );

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/match/${match.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as {
        match: MatchDetail;
        nowUnix: number;
      };
      if (body?.match) {
        setMatch(body.match);
        setReportedAtUnix(body.nowUnix);
      }
    } catch {
      // Keep the current data on a failed refresh rather than blanking the page.
    }
  }, [match.id]);

  /**
   * Poll while the match is live OR still to come, so a kickoff, the first goal
   * and every later change appear without a manual reload. A finished match has
   * nothing left to update, so polling stops there. Always pauses when hidden.
   */
  const shouldPoll = isLive || match.status === "scheduled";

  useEffect(() => {
    if (!shouldPoll) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (!timer) timer = setInterval(() => void refresh(), LIVE_POLL_SECONDS * 1000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [shouldPoll, refresh]);

  const dateKey = toDateKey(new Date(match.kickoffUnix * 1000), timezone);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={t.back}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            {/* Points right: the "back" direction in RTL. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
              aria-hidden="true"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>

          <h1 className="flex min-w-0 flex-1 items-center">
            <Link
              href={`/league/${match.league.id}`}
              className="flex min-w-0 items-center gap-2 transition-colors hover:text-accent"
            >
              <Crest src={match.league.logo} name={match.league.name} size={20} />
              <span className="truncate text-sm font-semibold text-foreground">
                {match.league.name}
              </span>
            </Link>
          </h1>
        </div>
      </header>

      {/* Scoreboard */}
      <section className="border-b border-border bg-surface px-3 py-5 sm:px-4">
        <div className="flex items-start gap-2">
          <TeamBlock
            name={match.home.name}
            logo={match.home.logo}
            countryCode={match.home.countryCode}
          />

          <div className="flex min-h-[4.5rem] w-24 shrink-0 flex-col items-center justify-center gap-1.5">
            {showScore ? (
              <>
                {match.score.confirmed ? (
                  <div
                    className={`flex items-center gap-2 text-2xl font-bold tnum ${
                      isLive ? "text-live" : "text-foreground"
                    }`}
                  >
                    <span>{match.score.home ?? 0}</span>
                    <span className="text-muted-dim">-</span>
                    <span>{match.score.away ?? 0}</span>
                  </div>
                ) : (
                  <span className="text-2xl font-bold text-muted-dim">–</span>
                )}

                {isLive ? (
                  <LiveBadge minute={clock.minute} isHalfTime={clock.isHalfTime} />
                ) : (
                  <span className="text-center text-[0.7rem] font-medium text-muted-dim">
                    {match.score.confirmed ? t.finished : t.awaitingResult}
                  </span>
                )}
              </>
            ) : (
              <>
                <span dir="ltr" className="text-xl font-bold text-foreground tnum">
                  {formatKickoff(match.kickoffUnix, timezone)}
                </span>
                <span className="text-[0.7rem] font-medium text-muted-dim">
                  {match.statusLabel}
                </span>
              </>
            )}
          </div>

          <TeamBlock
            name={match.away.name}
            logo={match.away.logo}
            countryCode={match.away.countryCode}
          />
        </div>
      </section>

      <main className="flex flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
        {match.goals && match.goals.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <h2 className="border-b border-divider px-4 py-2.5 text-sm font-semibold text-foreground">
              {t.goals}
            </h2>
            <ul>
              {match.goals.map((goal, i) => (
                <li
                  key={`${goal.minute}-${goal.player}-${i}`}
                  className={`flex items-center gap-2 border-b border-divider px-4 py-2 last:border-b-0 ${
                    goal.team === "away" ? "flex-row-reverse text-end" : ""
                  }`}
                >
                  <span className="min-w-[2.5rem] shrink-0 text-xs font-bold text-accent tnum">
                    {goal.minute}&apos;
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-foreground">
                      {goal.kind === "own" ? "🥅" : "⚽"} {goal.player}
                      {goal.kind === "own" && (
                        <span className="text-muted"> ({t.ownGoal})</span>
                      )}
                      {goal.kind === "penalty" && (
                        <span className="text-muted"> ({t.penalty})</span>
                      )}
                    </span>
                    {goal.assist && (
                      <span className="truncate text-[0.7rem] text-muted">
                        {t.assist}: {goal.assist}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hasStats && (
          <div role="tablist" className="flex items-center gap-1">
            <TabButton active={tab === "info"} onClick={() => setTab("info")}>
              {t.overview}
            </TabButton>
            <TabButton active={tab === "stats"} onClick={() => setTab("stats")}>
              {t.stats}
            </TabButton>
          </div>
        )}

        {tab === "stats" && hasStats ? (
          <MatchStatsPanel stats={match.stats} />
        ) : (
          <>
            <section className="overflow-hidden rounded-xl border border-border bg-surface">
              <h2 className="border-b border-divider px-4 py-2.5 text-sm font-semibold text-foreground">
                {t.matchInfo}
              </h2>
              <dl>
                <InfoRow label={t.competition} value={match.league.name} />
                <InfoRow label={t.date} value={formatDateLong(dateKey)} />
                <InfoRow
                  label={t.kickoff}
                  value={formatKickoff(match.kickoffUnix, timezone)}
                  ltr
                />
                {match.round.stage && (
                  <InfoRow label={t.stage} value={match.round.stage} />
                )}
                {match.venue?.name && (
                  <InfoRow
                    label={t.venue}
                    value={match.venue.name}
                    flag={match.venue.countryCode}
                  />
                )}
                {/* Referee: Footballdata.io exposes no referee, so this row only
                    appears if a provider that does supply it is wired in. */}
                {match.referee && (
                  <InfoRow
                    label={t.referee}
                    value={match.referee.name}
                    flag={match.referee.countryCode}
                  />
                )}
                {match.venue?.attendance != null && (
                  <InfoRow
                    label={t.attendance}
                    value={match.venue.attendance.toLocaleString("en-US")}
                    ltr
                  />
                )}
                {match.broadcast && (
                  <>
                    {/* The label follows the precision of the value: a specific
                        channel is "القناة الناقلة", a bare network is "الشبكة
                        الناقلة". Labelling "beIN SPORTS" as the channel would
                        read as a channel name and lose the distinction. */}
                    <InfoRow
                      label={match.broadcast.precise ? t.channel : t.network}
                      value={match.broadcast.channel}
                      ltr
                    />
                    {match.broadcast.commentator && (
                      <InfoRow
                        label={t.commentator}
                        value={match.broadcast.commentator}
                      />
                    )}
                  </>
                )}
              </dl>

              {/**
               * The caveat has to match the provenance. Three distinct cases,
               * and calling real provider data "editorial" would understate it
               * just as badly as calling a guess authoritative overstates it.
               */}
              {match.broadcast && (
                <p className="border-t border-divider px-4 py-2 text-[0.65rem] leading-relaxed text-muted-dim">
                  {match.broadcast.source === "provider"
                    ? `القناة الناقلة لمنطقة ${BROADCAST_REGION} حسب مزود البيانات، وقد تتغير.`
                    : match.broadcast.precise
                      ? `بيانات القناة والمعلق تحريرية لمنطقة ${BROADCAST_REGION} وليست من مزود البيانات، وقد تتغير.`
                      : `الشبكة الناقلة لمنطقة ${BROADCAST_REGION}. القناة المحددة تختلف بين المباريات المتزامنة ولا يوفرها مزود البيانات لقوائم المباريات.`}
                </p>
              )}
            </section>

          </>
        )}
      </main>
    </>
  );
}

interface TeamBlockProps {
  name: string;
  logo: string | null;
  countryCode: string | null;
}

function TeamBlock({ name, logo, countryCode }: TeamBlockProps) {
  // No longer a link: team pages were removed. Crest stays, so the logo shows.
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 px-1 py-1">
      <Crest src={logo} name={name} size={52} />
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="line-clamp-2 text-center text-xs font-semibold text-foreground">
          {name}
        </span>
        <Flag code={countryCode} />
      </span>
    </div>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
  flag?: string | null;
  ltr?: boolean;
}

function InfoRow({ label, value, flag, ltr }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-divider px-4 py-2.5 last:border-b-0">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        {flag ? <Flag code={flag} /> : null}
        <span
          dir={ltr ? "ltr" : undefined}
          className={`truncate text-xs font-medium text-foreground ${ltr ? "tnum" : ""}`}
        >
          {value}
        </span>
      </dd>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}


