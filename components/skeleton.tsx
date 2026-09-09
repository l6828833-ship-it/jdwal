/**
 * Loading placeholders.
 *
 * These exist because every data route in this app is `force-dynamic` and waits
 * on an upstream fetch. Without a Suspense fallback, Next.js holds the OLD page
 * on screen for the whole of that wait, so a tap registered as nothing happening
 * and the only recourse was a manual reload. The cold cost is real — the scorers
 * leaderboard took 13 seconds the first time it was built — so the feedback has
 * to be immediate and it has to be obvious.
 *
 * They deliberately mirror the shape of the real content rather than showing a
 * spinner: the layout does not lurch when data lands, and the outline itself
 * tells you which screen you are arriving at.
 *
 * Server Components with no state, so they are part of the prefetched static
 * shell and cost nothing to render.
 */

/** One shimmering block. `aria-hidden` — the live region on the boundary speaks. */
export function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-surface-hover ${className}`}
    />
  );
}

function Circle({ size = 24 }: { size?: number }) {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse rounded-full bg-surface-hover"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * Announces the wait once, for screen readers.
 *
 * The shimmer is purely visual, so without this the navigation is silent to
 * assistive technology. `role="status"` with `aria-live="polite"` reports it
 * without interrupting, and the visual skeleton is hidden from the tree so it
 * is not read out as a pile of meaningless boxes.
 */
export function LoadingAnnounce({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  );
}

/** A match row: crest, name, score placeholder, name, crest. */
export function MatchRowSkeleton() {
  return (
    <div className="flex items-center gap-2 px-3 py-3">
      <div className="flex flex-1 items-center justify-end gap-2">
        <Bar className="h-3 w-20 sm:w-28" />
        <Circle size={22} />
      </div>
      <Bar className="h-4 w-10 shrink-0" />
      <div className="flex flex-1 items-center gap-2">
        <Circle size={22} />
        <Bar className="h-3 w-20 sm:w-28" />
      </div>
    </div>
  );
}

/** A league card: header strip plus a few match rows. */
export function LeagueGroupSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Circle size={18} />
        <Bar className="h-3 w-32" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <MatchRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** The horizontally scrolling pill strip used for dates and league tabs. */
export function TabStripSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-1.5 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <Bar key={i} className="h-8 w-20 shrink-0 rounded-full" />
      ))}
    </div>
  );
}

/** A ranked list: position, crest, name, trailing number. Scorers, standings. */
export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-3 py-2.5">
        <Bar className="h-3 w-24" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <Bar className="h-3 w-4 shrink-0" />
            <Circle size={22} />
            <Bar className="h-3 flex-1 max-w-40" />
            <Bar className="h-3 w-6 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The back-arrow header, so the top of the screen doesn't jump. */
export function BackHeaderSkeleton() {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md sm:px-4">
      <Circle size={20} />
      <Bar className="h-3 w-28" />
    </header>
  );
}
