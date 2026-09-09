import { t } from "@/lib/i18n";
import type { MatchStats, StatPair } from "@/lib/types";

interface MatchStatsPanelProps {
  stats: MatchStats | null;
}

/**
 * Match statistics.
 *
 * Only rows the provider actually returned are rendered — its `-1` sentinel is
 * already mapped to null upstream, so a missing stat disappears instead of
 * showing as a zero.
 */
export function MatchStatsPanel({ stats }: MatchStatsPanelProps) {
  if (!stats || !stats.hasAny) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
        {t.noStats}
      </p>
    );
  }

  const rows: Array<{ label: string; pair: StatPair; percent?: boolean }> = [
    { label: t.possession, pair: stats.possession, percent: true },
    { label: t.shotsTotal, pair: stats.shotsTotal },
    { label: t.shotsOnTarget, pair: stats.shotsOnTarget },
    { label: t.corners, pair: stats.corners },
    { label: t.fouls, pair: stats.fouls },
    { label: t.offsides, pair: stats.offsides },
    { label: t.yellowCards, pair: stats.yellowCards },
    { label: t.redCards, pair: stats.redCards },
  ].filter((row) => row.pair.home !== null || row.pair.away !== null);

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
        {t.noStats}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      {rows.map((row) => (
        <StatRow key={row.label} label={row.label} pair={row.pair} percent={row.percent} />
      ))}
    </div>
  );
}

interface StatRowProps {
  label: string;
  pair: StatPair;
  percent?: boolean;
}

function StatRow({ label, pair, percent }: StatRowProps) {
  const home = pair.home ?? 0;
  const away = pair.away ?? 0;
  const total = home + away;
  const homeShare = total > 0 ? (home / total) * 100 : 50;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground tnum">
          {pair.home ?? "–"}
          {percent && pair.home !== null ? "٪" : ""}
        </span>
        <span className="text-muted">{label}</span>
        <span className="font-semibold text-foreground tnum">
          {pair.away ?? "–"}
          {percent && pair.away !== null ? "٪" : ""}
        </span>
      </div>

      {/* Split bar: home share grows from the right in RTL. */}
      <div
        className="flex h-1.5 overflow-hidden rounded-full bg-surface-raised"
        role="presentation"
      >
        <div className="bg-accent" style={{ width: `${homeShare}%` }} />
        <div className="flex-1 bg-muted-dim/40" />
      </div>
    </div>
  );
}
