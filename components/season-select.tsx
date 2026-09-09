"use client";

import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";

interface SeasonSelectProps {
  leagueId: number;
  /** Starting years, newest first. */
  seasons: number[];
  selected: number;
}

/**
 * Season picker for the standings.
 *
 * Navigates with `?season=` so the server re-fetches the table for that season.
 * Whether an older season actually differs depends on the backend source — the
 * page shows an honest note when the active source only carries the current
 * one.
 */
export function SeasonSelect({ leagueId, seasons, selected }: SeasonSelectProps) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted">
      <span className="sr-only sm:not-sr-only">{t.seasonLabel}</span>
      <select
        value={selected}
        onChange={(e) => {
          const year = e.target.value;
          router.push(`/league/${leagueId}?season=${year}`);
        }}
        className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground focus:border-accent focus:outline-none"
      >
        {seasons.map((year) => (
          <option key={year} value={year}>
            {formatSeason(year)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 2026 -> "2026/2027". */
function formatSeason(year: number): string {
  return `${year}/${year + 1}`;
}
