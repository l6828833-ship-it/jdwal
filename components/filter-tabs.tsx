"use client";

import { t } from "@/lib/i18n";

export type MatchFilter = "all" | "top";

interface FilterTabsProps {
  value: MatchFilter;
  onChange: (value: MatchFilter) => void;
  counts: { all: number; top: number };
}

/**
 * Two tabs only: All and Top ("Top" = pinned popular leagues).
 * No TV/channels tab.
 */
export function FilterTabs({ value, onChange, counts }: FilterTabsProps) {
  const tabs: Array<{ id: MatchFilter; label: string; count: number }> = [
    { id: "all", label: t.filterAll, count: counts.all },
    { id: "top", label: t.filterTop, count: counts.top },
  ];

  return (
    <div role="tablist" className="flex items-center gap-1">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className="ms-1.5 text-[0.68rem] font-medium text-muted-dim tnum">
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
