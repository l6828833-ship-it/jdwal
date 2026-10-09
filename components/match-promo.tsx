import Image from "next/image";

const PROMO_HREF = "https://linkly.link/2uinK";

interface PromoProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Max rendered width class, e.g. "max-w-sm". */
  maxWidth?: string;
  sizes?: string;
}

/**
 * Sponsored banner. `rel="sponsored"` tells search engines this is a paid
 * link, so it passes no ranking signal and is not treated as a link scheme.
 */
function Promo({ src, alt, width, height, maxWidth = "max-w-sm", sizes }: PromoProps) {
  return (
    <aside aria-label="إعلان" className="flex flex-col items-center gap-1">
      <span className="text-[0.65rem] text-muted-dim">إعلان</span>
      <a
        href={PROMO_HREF}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className={`block w-full ${maxWidth} overflow-hidden rounded-xl border border-border transition-opacity hover:opacity-90`}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes ?? "(max-width: 640px) 100vw, 384px"}
          className="h-auto w-full"
        />
      </a>
    </aside>
  );
}

/** Match page: between the timeline and the match info. */
export function MatchPromo() {
  return (
    <Promo
      src="/ads/iptv-premium.png"
      alt="IPTV — تجربة بث مميزة للمباريات والأفلام والمسلسلات"
      width={1734}
      height={907}
      maxWidth="max-w-xl"
      sizes="(max-width: 640px) 100vw, 576px"
    />
  );
}

/** Fixture list: after the second competition's matches. */
export function ListPromo() {
  return (
    <div className="py-3">
      <Promo
        src="/ads/iptv-yellow.png"
        alt="IPTV — تجربة بث مباشر للمباريات والقنوات"
        width={1122}
        height={1402}
      />
    </div>
  );
}
