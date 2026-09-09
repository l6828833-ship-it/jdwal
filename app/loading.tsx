import {
  Bar,
  LeagueGroupSkeleton,
  LoadingAnnounce,
  TabStripSkeleton,
} from "@/components/skeleton";
import { t } from "@/lib/i18n";

/**
 * The fixture list.
 *
 * Also covers the way BACK: tapping the Matches tab from a match or a league
 * previously sat on the old screen while the day's fixtures were re-fetched.
 */
export default function Loading() {
  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md sm:px-4">
        <Bar className="h-5 w-24" />
        <Bar className="size-8 rounded-full" />
      </header>

      <div className="flex flex-col gap-3 px-3 pt-3 sm:px-4">
        <TabStripSkeleton count={7} />
        <div className="flex items-center justify-between gap-2">
          <TabStripSkeleton count={2} />
          <Bar className="h-7 w-16 rounded-full" />
        </div>
        {/* Matches the fixed-height status strip on the real page, so the list
            below does not shift when the data arrives. */}
        <div className="h-4" />
      </div>

      <main className="flex flex-1 flex-col gap-3 px-3 pb-6 sm:px-4">
        <LoadingAnnounce label={t.loading} />
        <LeagueGroupSkeleton rows={4} />
        <LeagueGroupSkeleton rows={3} />
        <LeagueGroupSkeleton rows={2} />
      </main>
    </>
  );
}
