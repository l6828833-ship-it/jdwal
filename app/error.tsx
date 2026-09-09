"use client";

import { t } from "@/lib/i18n";

/**
 * Recovery UI for a route that threw while rendering.
 *
 * Without this file a failed navigation had no visible outcome and no way
 * forward — the click appeared to do nothing and the only recourse was reloading
 * the page by hand. `reset()` re-renders the segment in place, which is the same
 * thing a reload achieves without losing the app shell or the scroll position.
 *
 * Deliberately at the root so it covers every route. Data-shaped failures the
 * app can explain (quota exhausted, competition not on the plan, backend
 * unreachable) are still handled inside the pages themselves with their own
 * specific wording; this catches only what those did not anticipate.
 *
 * Must be a Client Component: it takes `reset`, an interactive callback.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="mb-2 text-base font-bold text-foreground">
          {t.loadFailed}
        </h1>
        {/**
         * `dir="ltr"` because the message is an English technical string; left to
         * the page's RTL direction its punctuation reorders and becomes hard to
         * read. In production Next.js replaces it with a digest, so this stays
         * useful for reporting without leaking a stack trace.
         */}
        <p dir="ltr" className="break-words text-xs leading-relaxed text-muted">
          {error.message || error.digest || "Unknown error"}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
        >
          {t.retry}
        </button>
      </div>
    </div>
  );
}
