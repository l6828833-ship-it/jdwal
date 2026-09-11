import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `/match` -> `/`.
   *
   * Match pages live at `/match/<id>`, so `/match` is the parent a visitor edits
   * the address bar down to and the parent a crawler infers from any match link.
   * It used to 404 with Next's default English page.
   *
   * A redirect rather than a page, because the content it would hold is already
   * the homepage: any fixture list here duplicates `/` and the two compete for
   * the same query, with this one the weaker of the pair (no live clock, no date
   * selector, no filters). It is also better than simply deleting the route,
   * which would bring the 404 back, and better than a `noindex` page, because a
   * permanent redirect CONSOLIDATES this URL's links and authority into `/`
   * instead of discarding them.
   *
   * `permanent: true` emits 308. Google treats it exactly like a 301 for
   * indexing and consolidation, and it additionally preserves the HTTP method.
   *
   * The `source` is the exact path — `/match/<id>` is untouched.
   */
  async redirects() {
    return [{ source: "/match", destination: "/", permanent: true }];
  },
  images: {
    // League crests and team logos are served from footballdata.io.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "footballdata.io",
        pathname: "/img/**",
      },
      // Crests for the RapidAPI provider (FotMob CDN, keyed by team/league id).
      {
        protocol: "https",
        hostname: "images.fotmob.com",
        pathname: "/image_resources/**",
      },
      // Crests and country flags for the Highlightly provider.
      {
        protocol: "https",
        hostname: "highlightly.net",
        pathname: "/soccer/images/**",
      },
      // API-Football's media CDN, used by the self-hosted backend when
      // SOURCE=apifootball. The backend proxies the JSON but not the images, so
      // they are still loaded directly from here.
      {
        protocol: "https",
        hostname: "media.api-sports.io",
        pathname: "/football/**",
      },
      {
        protocol: "https",
        hostname: "media.api-sports.io",
        pathname: "/flags/**",
      },
      // ESPN's CDN, used when the backend runs on SOURCE=espn (no API key).
      // Team and league crests plus player headshots all come from here.
      {
        protocol: "https",
        hostname: "a.espncdn.com",
        pathname: "/i/**",
      },
      // LiveScore's CDN, used when the backend runs on SOURCE=livescore.
      // Team crests and player photos come from here.
      {
        protocol: "https",
        hostname: "lsm-static-prod.livescore.com",
        pathname: "/**",
      },
      // 365scores' image CDN, used when the backend runs on SOURCE=365scores
      // (the default). Team crests, competition logos and player headshots all
      // come from here.
      {
        protocol: "https",
        hostname: "imagecache.365scores.com",
        pathname: "/image/upload/**",
      },
    ],
    // Crests are small and never change; cache them hard.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
