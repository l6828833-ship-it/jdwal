"use client";

import { DATE_RANGE_DAYS } from "@/lib/config";
import { dateKeyDiff, formatDateHeader, shiftDateKey } from "@/lib/date";
import { t } from "@/lib/i18n";

interface DateSelectorProps {
  selected: string;
  today: string;
  onSelect: (dateKey: string) => void;
}

/**
 * Yesterday / Today / Tomorrow pills, arrows to page further out, and the full
 * date underneath. In RTL the "previous" arrow points right and "next" points
 * left, following the reading direction.
 */
export function DateSelector({ selected, today, onSelect }: DateSelectorProps) {
  const offset = dateKeyDiff(today, selected);

  const quick = [
    { label: t.yesterday, key: shiftDateKey(today, -1) },
    { label: t.today, key: today },
    { label: t.tomorrow, key: shiftDateKey(today, 1) },
  ];

  const canGoBack = offset > -DATE_RANGE_DAYS;
  const canGoForward = offset < DATE_RANGE_DAYS;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ArrowButton
          direction="prev"
          label={t.previousDay}
          disabled={!canGoBack}
          onClick={() => onSelect(shiftDateKey(selected, -1))}
        />

        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar">
          {quick.map((item) => {
            const active = item.key === selected;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                aria-pressed={active}
                className={`flex-1 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-accent text-white"
                    : "bg-surface text-muted hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <ArrowButton
          direction="next"
          label={t.nextDay}
          disabled={!canGoForward}
          onClick={() => onSelect(shiftDateKey(selected, 1))}
        />
      </div>

      <p className="text-center text-xs font-medium text-muted tnum">
        {formatDateHeader(selected)}
      </p>
    </div>
  );
}

interface ArrowButtonProps {
  direction: "prev" | "next";
  label: string;
  disabled: boolean;
  onClick: () => void;
}

function ArrowButton({ direction, label, disabled, onClick }: ArrowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        aria-hidden="true"
      >
        {/* prev = right-pointing in RTL, next = left-pointing */}
        <path d={direction === "prev" ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} />
      </svg>
    </button>
  );
}
