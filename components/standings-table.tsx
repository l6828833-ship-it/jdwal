import { Crest } from "./crest";
import { t } from "@/lib/i18n";
import type { StandingRow } from "@/lib/types";

interface StandingsTableProps {
  rows: StandingRow[];
  /** Shown instead of the table when there are no rows. */
  emptyMessage?: string;
}

/**
 * League table.
 *
 * A real <table> with scoped headers so screen readers announce each cell in
 * context. Narrow columns are hidden on small screens rather than dropped from
 * the markup, so the data stays available to assistive tech and to wide screens.
 */
export function StandingsTable({ rows, emptyMessage }: StandingsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm leading-relaxed text-muted">
        {emptyMessage ?? t.noStandings}
      </p>
    );
  }

  /**
   * Competitions split into several tables (cup groups, a league phase plus
   * qualifying) arrive as one flat list of rows carrying a group label. Without
   * splitting them back out, "1" appears once per group and the ranking reads as
   * nonsense — so each group gets its own table.
   */
  const groups = groupRows(rows);
  if (groups.length > 1) {
    return (
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.name}>
            <h3 className="mb-1.5 px-1 text-[0.7rem] font-semibold text-muted">
              {group.name}
            </h3>
            <SingleTable rows={group.rows} caption={group.name} />
          </div>
        ))}
        <ZoneLegend rows={rows} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <SingleTable rows={rows} caption={t.standings} />
      <ZoneLegend rows={rows} />
    </div>
  );
}

/** Tailwind class for a row's zone colour band. */
function zoneBarClass(zone: StandingRow["zone"]): string {
  switch (zone) {
    case "champions":
      return "bg-emerald-500";
    case "europa":
      return "bg-sky-500";
    case "conference":
      return "bg-teal-400";
    case "promotion":
      return "bg-emerald-500";
    case "playoff":
      return "bg-amber-400";
    case "relegation":
      return "bg-red-500";
    default:
      return "bg-transparent";
  }
}

const ZONE_LABEL_AR: Record<string, string> = {
  champions: "التأهل لدوري الأبطال / الأدوار التالية",
  europa: "التأهل للدوري الأوروبي",
  conference: "التأهل لدوري المؤتمر",
  promotion: "الصعود",
  playoff: "الملحق",
  relegation: "الهبوط / الخروج",
};

/**
 * Legend for the colour bands.
 *
 * Built from the zones actually present, so a table shows only the bands it
 * uses and the labels come from the provider's own wording where available.
 */
function ZoneLegend({ rows }: { rows: StandingRow[] }) {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (row.zone && !seen.has(row.zone)) {
      seen.set(row.zone, row.zoneLabel || ZONE_LABEL_AR[row.zone] || "");
    }
  }
  if (seen.size === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 py-1 text-[0.65rem] text-muted">
      {[...seen.entries()].map(([zone, label]) => (
        <li key={zone} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`inline-block h-2.5 w-2.5 rounded-sm ${zoneBarClass(zone as StandingRow["zone"])}`}
          />
          {ZONE_LABEL_AR[zone] ?? label}
        </li>
      ))}
    </ul>
  );
}

interface RowGroup {
  name: string;
  rows: StandingRow[];
}

/** Split rows by their group label, preserving first-seen group order. */
function groupRows(rows: StandingRow[]): RowGroup[] {
  const byName = new Map<string, StandingRow[]>();
  for (const row of rows) {
    const name = row.group?.trim();
    // A single unlabelled table is the common case and must not be split.
    if (!name) return [];
    const bucket = byName.get(name);
    if (bucket) bucket.push(row);
    else byName.set(name, [row]);
  }
  return [...byName].map(([name, groupRowsList]) => ({ name, rows: groupRowsList }));
}

function SingleTable({
  rows,
  caption,
}: {
  rows: StandingRow[];
  caption: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-muted">
            <th scope="col" className="w-8 px-2 py-2.5 text-center font-medium">
              {t.colPosition}
            </th>
            <th scope="col" className="px-1 py-2.5 text-start font-medium">
              {t.colTeam}
            </th>
            <Num>{t.colPlayed}</Num>
            <Num hideOnMobile>{t.colWins}</Num>
            <Num hideOnMobile>{t.colDraws}</Num>
            <Num hideOnMobile>{t.colLosses}</Num>
            <Num hideOnMobile>{t.colGoalsFor}</Num>
            <Num hideOnMobile>{t.colGoalsAgainst}</Num>
            <Num>{t.colGoalDiff}</Num>
            <Num>{t.colPoints}</Num>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.position}-${row.team.id}`}
              className="border-b border-divider last:border-b-0"
            >
              <td className="relative px-2 py-2 text-center text-muted tnum">
                {/* Coloured band marking the qualification / relegation zone. */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 start-0 w-1 ${zoneBarClass(row.zone)}`}
                />
                {row.position}
              </td>
              <td className="px-1 py-2">
                {/* Not a link: team pages were removed. Crest + name stay. */}
                <div className="flex min-w-0 items-center gap-2">
                  <Crest src={row.team.logo} name={row.team.name} size={20} />
                  <span className="truncate font-medium text-foreground">
                    {row.team.name}
                  </span>
                </div>
              </td>
              <Cell>{row.played}</Cell>
              <Cell hideOnMobile>{row.wins}</Cell>
              <Cell hideOnMobile>{row.draws}</Cell>
              <Cell hideOnMobile>{row.losses}</Cell>
              <Cell hideOnMobile>{row.goalsFor}</Cell>
              <Cell hideOnMobile>{row.goalsAgainst}</Cell>
              <Cell>{formatDiff(row.goalDifference)}</Cell>
              <td className="px-2 py-2 text-center font-bold text-foreground tnum">
                {row.points ?? "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Goal difference reads more clearly with an explicit + on positives. */
function formatDiff(value: number | null): string {
  if (value === null) return "–";
  return value > 0 ? `+${value}` : String(value);
}

function Num({
  children,
  hideOnMobile,
}: {
  children: React.ReactNode;
  hideOnMobile?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`w-8 px-1 py-2.5 text-center font-medium ${
        hideOnMobile ? "hidden sm:table-cell" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Cell({
  children,
  hideOnMobile,
}: {
  children: React.ReactNode;
  hideOnMobile?: boolean;
}) {
  return (
    <td
      className={`px-1 py-2 text-center text-muted tnum ${
        hideOnMobile ? "hidden sm:table-cell" : ""
      }`}
    >
      {children ?? "–"}
    </td>
  );
}
