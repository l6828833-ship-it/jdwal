"use client";

import { developmentDetail, publicErrorMessage } from "@/lib/errors";
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
  const detail = developmentDetail(error);

  return (
    <div data-nosnippet className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="mb-2 text-base font-bold text-foreground">
          {t.loadFailed}
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          {publicErrorMessage(error)}
        </p>

        {/**
         * The raw message in development, the digest in production.
         *
         * Next.js already redacts a SERVER error's message down to a digest
         * before it reaches this component, but a CLIENT-side throw arrives
         * intact — so printing `error.message` unconditionally could still put an
         * internal string on the page. `developmentDetail` returns null in a
         * production build, which leaves the digest: a reference a user can quote
         * in a bug report and which matches the server log, without describing
         * the failure.
         *
         * `dir="ltr"` because it is English technical text whose punctuation
         * reorders under the page's RTL direction.
         */}
        {(detail || error.digest) && (
          <p
            dir="ltr"
            className="mt-3 break-words border-t border-border pt-3 text-[0.68rem] leading-relaxed text-muted-dim"
          >
            {detail || error.digest}
          </p>
        )}
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
