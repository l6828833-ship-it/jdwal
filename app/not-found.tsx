import type { Metadata } from "next";
import { NavLink } from "@/components/nav-link";
import { NOINDEX_FOLLOW } from "@/lib/seo";
import { t } from "@/lib/i18n";

/**
 * The 404 page.
 *
 * Without this file Next.js serves its own built-in one, which reads "This page
 * could not be found." — unstyled English, left-to-right, on an Arabic RTL site.
 * To a visitor that does not look like a missing page, it looks like the site is
 * broken; and it offered no way onward, so a mistyped or stale URL was a dead
 * end.
 *
 * The metadata overrides matter more than they look.
 *
 * Metadata is INHERITED from the root layout, which declares `index, follow` and
 * a canonical of `/` — correct for a content page, wrong for this one. Left
 * alone, a 404 response went out carrying Next's automatic `noindex` AND the
 * layout's `index, follow`, a straight contradiction, plus a canonical claiming
 * this page is the homepage. Both are stated explicitly here instead:
 *
 *   • `robots` repeats noindex so the inherited value cannot win. Two agreeing
 *     noindex tags are fine; one of each is not.
 *   • `canonical: null` clears the inherited URL. A canonical is a claim about
 *     which URL holds this content, and a missing page holds none.
 */
export const metadata: Metadata = {
  title: t.notFoundTitle,
  robots: NOINDEX_FOLLOW,
  alternates: { canonical: null },
};

export default function NotFound() {
  return (
    <main
      data-nosnippet
      className="flex flex-1 items-center justify-center px-4 py-16"
    >
      <div className="max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        <p className="text-3xl font-bold text-accent">404</p>
        <h1 className="mt-2 text-base font-bold text-foreground">
          {t.notFoundTitle}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {t.notFoundBody}
        </p>

        {/* A way onward, and — because this page is reachable by a crawler
            following a stale link — a route back into the indexable pages. */}
        <nav className="mt-5 flex flex-wrap justify-center gap-2">
          <NavLink
            href="/"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
          >
            {t.notFoundHome}
          </NavLink>
          <NavLink
            href="/match"
            className="rounded-full bg-surface-hover px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-foreground"
          >
            {t.allMatches}
          </NavLink>
          <NavLink
            href="/leagues"
            className="rounded-full bg-surface-hover px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-foreground"
          >
            {t.navLeagues}
          </NavLink>
        </nav>
      </div>
    </main>
  );
}
