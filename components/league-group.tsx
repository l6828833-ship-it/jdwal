import { NavLink } from "@/components/nav-link";
import { Crest } from "./crest";
import { MatchRow } from "./match-row";
import { t } from "@/lib/i18n";
import type { LeagueGroup as LeagueGroupData } from "@/lib/grouping";

/** Ranked-bars glyph, the conventional standings icon. */
function StandingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="size-3.5"
      aria-hidden="true"
    >
      <path d="M5 20V10M12 20V4M19 20v-6" />
    </svg>
  );
}

interface LeagueGroupProps {
  group: LeagueGroupData;
  /** Passed down so live minutes can tick locally between polls. */
  nowUnix?: number;
  /** Server time the payload was normalized; see MatchRow. */
  reportedAtUnix?: number;
}

/**
 * A league block: crest + name header, then its fixtures.
 * Header carries a thin accent left border (right, in RTL) and nothing else —
 * no trailing chevrons, follow buttons or extra icons.
 */
export function LeagueGroup({
  group,
  nowUnix,
  reportedAtUnix,
}: LeagueGroupProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* border-s = inline-start, i.e. the right edge in RTL: the leading edge. */}
      <header
        className={`border-s-2 ${
          group.isPopular ? "border-s-accent bg-accent-soft/40" : "border-s-border"
        }`}
      >
        {/* Crest + name link to the league page; the trailing standings icon
            is an explicit affordance for the table, as requested. */}
        <NavLink
          href={`/league/${group.league.id}`}
          className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-surface-hover sm:px-4"
        >
          <Crest src={group.league.logo} name={group.league.name} size={22} />
          <h2 className="truncate text-sm font-semibold text-foreground">
            {group.league.name}
          </h2>
          <span className="ms-auto flex shrink-0 items-center gap-1 rounded-full bg-surface-raised px-2 py-1 text-[0.62rem] font-medium text-muted">
            <StandingsIcon />
            {t.standings}
          </span>
        </NavLink>
      </header>

      <ul>
        {group.matches.map((match) => (
          <MatchRow
            key={match.id}
            match={match}
            nowUnix={nowUnix}
            reportedAtUnix={reportedAtUnix}
          />
        ))}
      </ul>
    </section>
  );
}
