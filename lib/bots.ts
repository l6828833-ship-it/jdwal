/**
 * Crawlers that bring this site no visitors but still cost backend calls.
 *
 * Every page a crawler requests that is not already cached triggers a request
 * to the SportScore backend on Cloud Run, which is billed per request/CPU time.
 * These are AI-training scrapers and SEO-tool crawlers: they walk every
 * `/match/<id>` and `/league/<id>` URL they can find, and send no traffic back.
 *
 * Deliberately NOT listed: Googlebot, Bingbot, Mediapartners-Google (AdSense),
 * AdsBot-Google, Applebot, DuckDuckBot, Yandex, and social link previews
 * (facebookexternalhit, Twitterbot, WhatsApp, TelegramBot). Those are search,
 * ads or sharing, and blocking them would cost real visitors or ad revenue.
 *
 * Used twice: robots.txt asks them politely, and proxy.ts returns 403 for the
 * ones that ignore robots.txt (Bytespider and several others do).
 */
export const BLOCKED_BOTS = [
  // AI training / AI search scrapers
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "FacebookBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "cohere-ai",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "YouBot",
  "Timpibot",
  // SEO / backlink crawlers
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "DataForSeoBot",
  "SeznamBot",
  "PetalBot",
  "serpstatbot",
  "barkrowler",
  "MegaIndex",
  "ZoominfoBot",
];

const BLOCKED_PATTERN = new RegExp(
  BLOCKED_BOTS.map((name) => name.replace(/[-]/g, "\\-")).join("|"),
  "i",
);

export function isBlockedBot(userAgent: string | null): boolean {
  return !!userAgent && BLOCKED_PATTERN.test(userAgent);
}
