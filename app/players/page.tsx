import { PlayersSearch } from "@/components/players-search";
import { ApiKeyNotice } from "@/components/notices";
import { hasPlayerSearch } from "@/lib/provider";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata = { title: `${t.playersTitle} — ${t.appName}` };

export default function PlayersPage() {
  if (!hasPlayerSearch()) return <ApiKeyNotice />;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-3 py-4 backdrop-blur-md sm:px-4">
        <h1 className="text-base font-bold text-foreground">{t.playersTitle}</h1>
        <p className="mt-0.5 text-xs text-muted">{t.playersHint}</p>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
        <PlayersSearch />
      </main>
    </>
  );
}
