import { Crest } from "./crest";
import { t } from "@/lib/i18n";
import type { Match } from "@/lib/types";

interface KnockoutBracketProps {
  matches: Match[];
}

/**
 * Knockout bracket for a cup/tournament.
 *
 * Cup fixtures carry a round label ("Round of 16", "Quarter-finals", …) in
 * `round.stage`. This groups ties by that label, orders the rounds from
 * earliest to the final, and lays them out as columns — the conventional
 * bracket shape, scrollable on a phone.
 *
 * Ties without a recognised knockout label (a group/league phase) are skipped
 * here; the league page shows those as a table instead. If nothing maps to a
 * knockout round, the whole bracket renders nothing and the caller falls back
 * to the plain match list.
 */

/** Canonical round order, earliest first. Higher index = closer to the final. */
const ROUND_ORDER: Array<{ test: RegExp; ar: string; rank: number }> = [
  { test: /play.?off|preliminary|qualif/i, ar: "الأدوار التمهيدية", rank: 0 },
  { test: /round of 64|last 64/i, ar: "دور الـ64", rank: 1 },
  { test: /round of 32|last 32/i, ar: "دور الـ32", rank: 2 },
  { test: /round of 16|last 16|1\/8/i, ar: "دور الـ16", rank: 3 },
  { test: /quarter|last 8|1\/4/i, ar: "ربع النهائي", rank: 4 },
  { test: /semi|last 4|1\/2/i, ar: "نصف النهائي", rank: 5 },
  { test: /3rd place|third place/i, ar: "تحديد المركز الثالث", rank: 6 },
  { test: /final/i, ar: "النهائي", rank: 7 },
];

function classifyRound(stage: string | null): { ar: string; rank: number } | null {
  if (!stage) return null;
  // "final" must be tested last so it doesn't swallow "semi-final" — the array
  // is ordered so the more specific rounds match first.
  for (const round of ROUND_ORDER) {
    if (round.test.test(stage)) {
      // Guard: "semi-final" contains "final"; the semi entry precedes final in
      // the array, so it wins. Nothing more needed.
      return { ar: round.ar, rank: round.rank };
    }
  }
  return null;
}

interface BracketColumn {
  ar: string;
  rank: number;
  matches: Match[];
}

export function buildBracket(matches: Match[]): BracketColumn[] {
  const columns = new Map<number, BracketColumn>();
  for (const match of matches) {
    const round = classifyRound(match.round.stage);
    if (!round) continue;
    let col = columns.get(round.rank);
    if (!col) {
      col = { ar: round.ar, rank: round.rank, matches: [] };
      columns.set(round.rank, col);
    }
    col.matches.push(match);
  }
  return [...columns.values()]
    .map((col) => ({
      ...col,
      matches: col.matches.sort((a, b) => a.kickoffUnix - b.kickoffUnix),
    }))
    .sort((a, b) => a.rank - b.rank);
}

export function KnockoutBracket({ matches }: KnockoutBracketProps) {
  const columns = buildBracket(matches);
  if (columns.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-semibold text-foreground">
        {t.knockoutBracket}
      </h2>
      {/* Horizontal scroll: a full bracket is wider than a phone. */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3">
          {columns.map((col) => (
            <div key={col.rank} className="flex min-w-[13rem] flex-col gap-2">
              <h3 className="text-center text-[0.7rem] font-semibold text-accent">
                {col.ar}
              </h3>
              <div className="flex flex-1 flex-col justify-around gap-2">
                {col.matches.map((match) => (
                  <BracketTie key={match.id} match={match} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BracketTie({ match }: { match: Match }) {
  const decided = match.status === "finished";
  const homeWon = decided && (match.score.home ?? 0) > (match.score.away ?? 0);
  const awayWon = decided && (match.score.away ?? 0) > (match.score.home ?? 0);

  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <TieSide
        name={match.home.name}
        logo={match.home.logo}
        score={match.score.confirmed ? match.score.home : null}
        winner={homeWon}
      />
      <div className="my-1 h-px bg-divider" />
      <TieSide
        name={match.away.name}
        logo={match.away.logo}
        score={match.score.confirmed ? match.score.away : null}
        winner={awayWon}
      />
    </div>
  );
}

function TieSide({
  name,
  logo,
  score,
  winner,
}: {
  name: string;
  logo: string | null;
  score: number | null;
  winner: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Crest src={logo} name={name} size={18} />
      <span
        className={`min-w-0 flex-1 truncate text-xs ${
          winner ? "font-bold text-foreground" : "text-muted"
        }`}
      >
        {name}
      </span>
      <span
        className={`tnum text-xs ${winner ? "font-bold text-foreground" : "text-muted"}`}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}
