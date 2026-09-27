"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { ADSENSE_CLIENT_ID } from "@/lib/config";
import { useConsent } from "@/components/consent";

const ELIGIBLE_PATHS = ["/", "/leagues", "/scorers"] as const;
const ELIGIBLE_PREFIXES = ["/league/", "/guides/"] as const;

/**
 * AdSense site-verification tag.
 *
 * Google's review crawler must be able to see the publisher script on the
 * site BEFORE the account is approved and before any user has given consent.
 * This is the only case where the script is rendered unconditionally — it
 * carries no ad slots, sets no cookies, and does no targeting on its own.
 * Full Auto Ads (below) still gate on consent as before.
 *
 * The `data-overlaps-with-header` attribute is not used here; the script
 * tag alone is sufficient for ownership verification.
 */
export function AdSenseVerification() {
  if (process.env.NODE_ENV !== "production") return null;
  if (!ADSENSE_CLIENT_ID) return null;

  return (
    <Script
      id="adsense-verification"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
    />
  );
}

/**
 * AdSense Auto Ads bootstrap — shown only after the user accepts and only on
 * eligible content pages. Disabled until a real ca-pub id is configured.
 *
 * For EEA/UK/Swiss traffic, configure Google's certified Funding Choices CMP
 * in AdSense before enabling personalized ads; this local consent gate is not
 * represented as a substitute for Google's regional certification requirement.
 */
export function AdSense() {
  const pathname = usePathname() || "/";
  const { choice } = useConsent();
  const validClient = /^ca-pub-\d+$/.test(ADSENSE_CLIENT_ID);
  // Allowlist, not denylist: unknown/error/404 routes can never receive ads.
  const eligible =
    ELIGIBLE_PATHS.includes(pathname as (typeof ELIGIBLE_PATHS)[number]) ||
    ELIGIBLE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (
    process.env.NODE_ENV !== "production" ||
    !validClient ||
    choice !== "accepted" ||
    !eligible
  ) {
    return null;
  }

  return (
    <Script
      id="adsense-auto-ads"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
    />
  );
}
