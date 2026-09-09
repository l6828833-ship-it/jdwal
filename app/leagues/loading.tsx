import { Bar, LoadingAnnounce } from "@/components/skeleton";
import { t } from "@/lib/i18n";

/** The competition list: crest, name, country line, chevron. */
export default function Loading() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-3 py-4 backdrop-blur-md sm:px-4">
        <h1 className="text-base font-bold text-foreground">{t.leaguesTitle}</h1>
        <p className="mt-0.5 text-xs text-muted">{t.leaguesAvailable}</p>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
        <LoadingAnnounce label={t.loading} />
        <ul className="overflow-hidden rounded-xl border border-border bg-surface">
          {Array.from({ length: 12 }, (_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 border-b border-divider px-3 py-3 last:border-b-0 sm:px-4"
            >
              <Bar className="size-7 shrink-0 rounded-full" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Bar className="h-3 w-40 max-w-full" />
                <Bar className="h-2.5 w-24" />
              </span>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
