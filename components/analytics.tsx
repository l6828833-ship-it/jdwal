import Script from "next/script";
import { GA_MEASUREMENT_ID } from "@/lib/config";

/**
 * Google Analytics 4 (gtag.js).
 *
 * Loaded through `next/script` rather than raw `<script>` tags. Next.js then
 * owns the injection: it dedupes the script across navigations, keeps it out of
 * the critical path, and — with `afterInteractive` — starts it only once the
 * page has begun hydrating. Hand-written tags in the document head would block
 * first paint on a third-party request, which on a fixtures page that people
 * open on mobile data is a real cost for a measurement script.
 *
 * `afterInteractive`, not `beforeInteractive`: analytics has nothing to
 * contribute before the page renders, and `beforeInteractive` is documented for
 * scripts that must run ahead of Next's own code (consent gates, polyfills).
 *
 * Every navigation in this app is a REAL document load — see
 * components/nav-link.tsx — so gtag's automatic `page_view` on load already
 * covers every route. There is no SPA route-change hook to wire up, and adding
 * one would double-count.
 *
 * Development is excluded. Localhost hits otherwise land in the same property as
 * real traffic and quietly distort exactly the numbers the property exists to
 * report. Verify with GA4 Realtime against the deployed site instead.
 */
export function Analytics() {
  if (!GA_MEASUREMENT_ID || process.env.NODE_ENV !== "production") return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      {/* An `id` is required on an inline Script so Next can track it. */}
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}
