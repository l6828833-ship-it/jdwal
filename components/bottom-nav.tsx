"use client";

import { NavLink } from "@/components/nav-link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n";

/**
 * Three tabs: Matches, Scorers, Leagues.
 * Teams was removed; the middle tab is now the top-scorers leaderboard.
 */
const TABS = [
  { href: "/", label: t.navMatches, icon: BallIcon, match: (p: string) => p === "/" || p.startsWith("/match") },
  { href: "/scorers", label: t.navScorers, icon: BootIcon, match: (p: string) => p.startsWith("/scorers") || p.startsWith("/players") },
  { href: "/leagues", label: t.navLeagues, icon: TrophyIcon, match: (p: string) => p.startsWith("/leagues") || p.startsWith("/league/") },
] as const;

export function BottomNav() {
  const pathname = usePathname() || "/";

  return (
    <nav
      aria-label={t.navMatches}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur-md"
    >
      <ul className="mx-auto flex w-full max-w-3xl items-stretch pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <NavLink
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium transition-colors ${
                  active ? "text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-6" filled={active} />
                <span>{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface IconProps {
  className?: string;
  filled?: boolean;
}

function BallIcon({ className, filled }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={filled ? 2.1 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.4 8.9 9.7l1.2 3.7h3.8l1.2-3.7z" />
      <path d="M12 3v4.4M4.3 9.9l4.6-.2M19.7 9.9l-4.6-.2M7.1 19.6l3-6.2M16.9 19.6l-3-6.2" />
    </svg>
  );
}

/** A football boot — the conventional top-scorer glyph. */
function BootIcon({ className, filled }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h5l1.5 5.5L18 13a3 3 0 0 1 3 3v2H4z" />
      <path d="M4 18v-6" />
      <path d="M7 18v2M11 18v2M15 18v2M19 18v2" />
    </svg>
  );
}

function TrophyIcon({ className, filled }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 5.5H5.5A2.5 2.5 0 0 0 8 10M16 5.5h2.5A2.5 2.5 0 0 1 16 10" />
      <path d="M12 13v3M9 20h6M10 20c0-1.5.7-2.4 2-2.4s2 .9 2 2.4" />
    </svg>
  );
}
