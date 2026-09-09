import {
  Bar,
  BackHeaderSkeleton,
  LeagueGroupSkeleton,
  LoadingAnnounce,
  TabStripSkeleton,
  TableSkeleton,
} from "@/components/skeleton";
import { t } from "@/lib/i18n";

/**
 * A competition page: standings table plus recent and upcoming fixtures.
 *
 * It awaits standings, fixtures and a backend capability check, so it is one of
 * the heavier routes. Both blocks are outlined because the page shows both.
 */
export default function Loading() {
  return (
    <>
      <LoadingAnnounce label={t.loading} />
      <BackHeaderSkeleton />

      {/* League identity: crest, name, country. */}
      <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-4 sm:px-4">
        <Bar className="size-11 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Bar className="h-4 w-44 max-w-full" />
          <Bar className="h-2.5 w-24" />
        </div>
      </div>

      <div className="px-3 py-3 sm:px-4">
        <TabStripSkeleton count={3} />
      </div>

      <main className="flex flex-1 flex-col gap-3 px-3 pb-6 sm:px-4">
        <TableSkeleton rows={10} />
        <LeagueGroupSkeleton rows={3} />
      </main>
    </>
  );
}
