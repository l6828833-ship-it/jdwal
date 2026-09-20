"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { ADSENSE_CLIENT_ID } from "@/lib/config";
import { useConsent } from "@/components/consent";

const ELIGIBLE_PATHS = ["/", "/leagues", "/scorers"] as const;
const ELIGIBLE_PREFIXES = ["/league/", "/guides/"] as const;

/**
 * AdSense Auto Ads bootstrap, disabled until a real ca-pub id is configured.
 * It also stays off policy, contact, thin search and noindex match pages.
 *
 * For EEA/UK/Swiss traffic, configure Google's certified Funding Choices CMP
 * in AdSense before enabling ads; this local consent gate is not represented as
 * a substitute for Google's regional certification requirement.
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
