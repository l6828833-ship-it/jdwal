import type { AnchorHTMLAttributes } from "react";

/**
 * A link that performs a REAL browser navigation.
 *
 * Deliberately a plain `<a>` rather than `next/link`, and that is the entire
 * point of this file existing.
 *
 * ── Why not client-side navigation ──────────────────────────────────────────
 *
 * With `next/link` the router intercepts the click and swaps the page in place.
 * Nothing in the browser chrome changes: no tab spinner, no progress bar, no
 * cursor change. The only feedback is whatever the app renders itself, so if the
 * app renders nothing for a moment the click looks ignored — and people respond
 * by tapping again or reloading by hand.
 *
 * That is worse here than it would be in most apps, for reasons specific to this
 * one:
 *
 *  • Every route is `force-dynamic` and waits on the upstream backend, so a
 *    client-side transition still needs a server round trip. The usual reason to
 *    prefer it — avoiding the network — does not apply.
 *  • Prefetching is not producing a usable payload for these routes (the RSC
 *    prefetch responds empty), so a click starts from cold regardless.
 *  • The root layout awaits request-time data (timezone and clock, both resolved
 *    over the network), and Next.js documents that `loading.js` cannot show a
 *    fallback for work done in a layout — navigation blocks until the layout
 *    resolves. So the skeletons cannot reliably cover the gap on a client
 *    transition.
 *
 * A document navigation costs about 0.7s here versus roughly 0.3s for the RSC
 * fetch. In exchange the browser does the one thing the app cannot: it shows its
 * own native loading indicator, immediately, on every device, in a form every
 * user already recognises. For a slow backend that trade is worth making.
 *
 * The `loading.tsx` skeletons still do their job — the server streams them first
 * (first byte at ~0.4s) and fills in the content behind them — so the sequence is
 * browser indicator, then skeleton, then content.
 *
 * ── Reverting ───────────────────────────────────────────────────────────────
 *
 * To go back to client-side navigation, change the implementation here to render
 * `next/link`; every call site already uses this component and needs no edits.
 */
export function NavLink({
  href,
  children,
  ...rest
}: { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
