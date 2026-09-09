import { Crest, Flag } from "./crest";
import { t } from "@/lib/i18n";
import type { LeagueScorers } from "@/lib/types";

interface ScorersTableProps {
  data: LeagueScorers;
}

/**
 * League top scorers.
 *
 * Renders three distinct states rather than collapsing them, because they mean
 * very different things:
 *   • `available: false` — this backend has no leaderboard endpoint at all, so
 *     the honest explanation is shown instead of an empty table.
 *   • available but empty — the season has data coverage but no goals recorded
 *     yet (a season that hasn't kicked off).
 *   • rows — the table.
 */
export function ScorersTable({ data }: ScorersTableProps) {
  if (!data.available) {
    return (
      <section className="rounded-xl border border-border bg-surface px-4 py-4">
        <h2 className="mb-1 text-xs font-semibold text-foreground">
          {t.scorersUnavailable}
        </h2>
        <p className="text-[0.7rem] leading-relaxed text-muted">
          {t.scorersUnavailableWhy}
        </p>
      </section>
    );
  }

  if (data.scorers.length === 0) {
    return (
      <section>
        <h2 className="mb-1.5 px-1 text-xs font-semibold text-foreground">
          {t.topScorers}
        </h2>
        <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          {t.noScorers}
        </p>
      </section>
    );
  }

  // Only show the appearances / assists columns when the source actually
  // carries them. LiveScore's leaderboard is goals-only, so rendering those
  // columns there would be a table full of "–" that reads as broken. A column
  // appears the moment at least one row has a real value for it.
  const showAppearances = data.scorers.some(
    (entry) => entry.appearances != null,
  );
  const showAssists = data.scorers.some((entry) => entry.assists != null);

  return (
    <section>
      <h2 className="mb-1.5 px-1 text-xs font-semibold text-foreground">
        {t.topScorers}
      </h2>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">{t.topScorers}</caption>
          <thead>
            <tr className="border-b border-border text-muted">
              <th scope="col" className="w-8 px-2 py-2.5 text-center font-medium">
                {t.colPosition}
              </th>
              <th scope="col" className="px-1 py-2.5 text-start font-medium">
                {t.colPlayer}
              </th>
              {showAppearances && (
                <th
                  scope="col"
                  className="w-10 px-1 py-2.5 text-center font-medium"
                >
                  {t.colAppearances}
                </th>
              )}
              {showAssists && (
                <th
                  scope="col"
                  className="w-10 px-1 py-2.5 text-center font-medium"
                >
                  {t.colAssists}
                </th>
              )}
              <th scope="col" className="w-10 px-2 py-2.5 text-center font-medium">
                {t.colGoals}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.scorers.map((entry) => (
              <tr
                key={entry.player.id}
                className="border-b border-divider last:border-b-0"
              >
                <td className="px-2 py-2 text-center text-muted tnum">
                  {entry.rank}
                </td>
                <td className="px-1 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Crest
                      src={entry.player.photo}
                      name={entry.player.name}
                      size={22}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-foreground">
                        {entry.player.name}
                      </span>
                      <span className="flex items-center gap-1 truncate text-[0.65rem] text-muted">
                        {/* Club crest (from the source), else the player's
                            nationality flag, so a row always has an emblem. */}
                        {entry.team?.logo ? (
                          <Crest
                            src={entry.team.logo}
                            name={entry.team.name ?? ""}
                            size={14}
                          />
                        ) : (
                          <Flag code={entry.player.countryCode} />
                        )}
                        {entry.team?.name}
                      </span>
                    </span>
                  </div>
                </td>
                {showAppearances && (
                  <td className="px-1 py-2 text-center text-muted tnum">
                    {entry.appearances ?? "–"}
                  </td>
                )}
                {showAssists && (
                  <td className="px-1 py-2 text-center text-muted tnum">
                    {entry.assists ?? "–"}
                  </td>
                )}
                <td className="px-2 py-2 text-center font-bold text-foreground tnum">
                  {entry.goals ?? "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
