import {
  Bar,
  BackHeaderSkeleton,
  LoadingAnnounce,
  TableSkeleton,
} from "@/components/skeleton";
import { t } from "@/lib/i18n";

/**
 * Shown the instant a match row is tapped.
 *
 * `/match/[id]` is `force-dynamic` and awaits the provider, so before this file
 * existed the router had nothing to show and left the fixture list on screen for
 * the whole round trip — the tap looked ignored. Next.js prefetches this fallback
 * with the link, so it appears immediately and the real content streams in behind
 * it.
 *
 * The shape is the detail screen's own: header, scoreline, tab strip, content.
 * Nothing moves when the data lands.
 */
export default function Loading() {
  return (
    <>
      <LoadingAnnounce label={t.loading} />
      <BackHeaderSkeleton />

      {/* Scoreline: crest + name on each side, score in the middle. */}
      <div className="border-b border-border bg-surface px-3 py-6 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-1 flex-col items-center gap-2">
            <Bar className="size-12 rounded-full" />
            <Bar className="h-3 w-16" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Bar className="h-8 w-20" />
            <Bar className="h-3 w-12" />
          </div>
          <div className="flex flex-1 flex-col items-center gap-2">
            <Bar className="size-12 rounded-full" />
            <Bar className="h-3 w-16" />
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 px-3 py-3 sm:px-4">
        <Bar className="h-8 w-20 rounded-full" />
        <Bar className="h-8 w-20 rounded-full" />
        <Bar className="h-8 w-20 rounded-full" />
      </div>

      <main className="flex flex-1 flex-col px-3 pb-6 sm:px-4">
        <TableSkeleton rows={6} />
      </main>
    </>
  );
}
