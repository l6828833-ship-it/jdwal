import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
