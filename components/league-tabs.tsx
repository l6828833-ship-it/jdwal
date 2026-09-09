"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

interface LeagueTabsProps {
  /** When false (a pure cup with no table), Matches is the only tab. */
  hasStandings: boolean;
  standings: React.ReactNode;
  matches: React.ReactNode;
}

type Tab = "standings" | "matches";

/**
 * Standings / Matches switch for the league page.
 *
 * Both panels are rendered on the server and passed in; this only toggles which
 * is visible, so switching is instant with no refetch. A competition with no
 * table (a knockout-only cup) drops the Standings tab and shows matches
 * directly.
 */
export function LeagueTabs({ hasStandings, standings, matches }: LeagueTabsProps) {
  const [tab, setTab] = useState<Tab>(hasStandings ? "standings" : "matches");

  if (!hasStandings) {
    return <>{matches}</>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label={t.appName}
        className="flex gap-1 rounded-full bg-surface p-1"
      >
        <TabButton
          active={tab === "standings"}
          onClick={() => setTab("standings")}
        >
          {t.tabStandings}
        </TabButton>
        <TabButton active={tab === "matches"} onClick={() => setTab("matches")}>
          {t.tabMatches}
        </TabButton>
      </div>

      <div role="tabpanel">{tab === "standings" ? standings : matches}</div>
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
      className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-accent text-white"
          : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
