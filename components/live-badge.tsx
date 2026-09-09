import { t } from "@/lib/i18n";

interface LiveBadgeProps {
  /** Derived minute; null falls back to the plain LIVE label. */
  minute?: number | null;
  isHalfTime?: boolean;
  className?: string;
}

/**
 * Small pill with a pulsing dot for a match in progress.
 *
 * The minute is derived from kickoff (the provider exposes no clock), so it is
 * shown as an approximate elapsed time, never as an official match clock.
 */
export function LiveBadge({ minute, isHalfTime, className = "" }: LiveBadgeProps) {
  const label = isHalfTime
    ? t.halfTime
    : minute != null
      ? `${minute}${t.minuteShort}`
      : t.live;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2 py-0.5 text-[0.68rem] font-semibold text-live tnum ${className}`}
    >
      <span className="live-dot size-1.5 rounded-full bg-live" />
      {label}
    </span>
  );
}

interface LivePillProps {
  count: number;
  active: boolean;
  onToggle: () => void;
}

/** "مباشر (n)" toggle that filters the list down to live matches. */
export function LivePill({ count, active, onToggle }: LivePillProps) {
  const disabled = count === 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-live bg-live/15 text-live"
          : disabled
            ? "cursor-not-allowed border-border text-muted-dim"
            : "border-border text-muted hover:border-live/60 hover:text-live"
      }`}
    >
      <span className="relative inline-flex size-2 items-center justify-center">
        <span
          className={`size-2 rounded-full ${count > 0 ? "bg-live" : "bg-muted-dim"}`}
        />
        {count > 0 && <span className="live-halo absolute inset-0" />}
      </span>
      <span className="tnum">
        {t.liveCount} ({count})
      </span>
    </button>
  );
}
