import Image from "next/image";

/**
 * Sponsored banner on the match page, between the timeline and the match info.
 *
 * `rel="sponsored"` tells search engines this is a paid link, so it passes no
 * ranking signal and is not treated as a link scheme.
 */
export function MatchPromo() {
  return (
    <aside aria-label="إعلان" className="flex flex-col items-center gap-1">
      <span className="text-[0.65rem] text-muted-dim">إعلان</span>
      <a
        href="https://www.strong8kiptv.co/ar"
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="block w-full max-w-sm overflow-hidden rounded-xl border border-border transition-opacity hover:opacity-90"
      >
        <Image
          src="/ads/strong-iptv-8k.png"
          alt="Strong IPTV 8K — بث مباشر ورياضة وأفلام ومسلسلات على أي شاشة بسعر 3.99 دولار"
          width={1254}
          height={1254}
          sizes="(max-width: 640px) 100vw, 384px"
          className="h-auto w-full"
        />
      </a>
    </aside>
  );
}
