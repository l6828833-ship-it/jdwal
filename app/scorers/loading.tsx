import {
  Bar,
  LoadingAnnounce,
  TabStripSkeleton,
  TableSkeleton,
} from "@/components/skeleton";
import { t } from "@/lib/i18n";

/**
 * The slowest screen in the app, and the one that most needed this.
 *
 * The backend computes a leaderboard by scanning a window of fixtures, which on
 * a cold cache measured 13 seconds. For all of it the app previously showed the
 * previous page, unchanged and apparently broken.
 *
 * The heading is real text rather than a placeholder: it is known without any
 * data, so showing it means the screen identifies itself the moment it appears.
 */
export default function Loading() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="px-3 py-4 sm:px-4">
          <h1 className="text-base font-bold text-foreground">{t.topScorers}</h1>
          <p className="mt-0.5 text-xs text-muted">{t.scorersHint}</p>
        </div>
        <div className="px-3 pb-3 sm:px-4">
          <TabStripSkeleton count={7} />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
        <LoadingAnnounce label={t.loading} />
        <TableSkeleton rows={12} />
        <Bar className="mx-auto h-3 w-32" />
      </main>
    </>
  );
}
