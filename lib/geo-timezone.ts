// Server-only by construction: it imports `next/headers`, which throws if pulled
// into a client bundle. No `server-only` package needed to enforce that.
import { headers } from "next/headers";
import { FALLBACK_TIMEZONE, toDateKey } from "./date";
import { ensureTrueTime, hostClockOffsetSeconds, nowDate, nowUnix } from "./true-time";

/**
 * The visitor's IANA timezone, resolved on the server from their IP.
 *
 * The DEVICE is not a source. A machine's own zone setting is frequently wrong
 * — a laptop that travelled and never re-synced, an imaged corporate build, a
 * VM left on its install default — and when it is wrong, every kickoff time and
 * the "today" the app opens on are wrong with it, which is indistinguishable
 * from the app being broken. The visitor's network location is a better signal
 * than a setting nobody checks, so it is the only one used.
 *
 * Why the server does this at all: the first paint is server-rendered, before
 * any client JS runs. Without resolving here, that paint uses one fixed zone for
 * everyone and "today" can be a day off for a distant visitor until hydration
 * corrects it — a visible flicker at best, the wrong day's fixtures at worst.
 *
 * Resolution order, cheapest and most reliable first:
 *
 *   1. Platform geo headers. A host that terminates traffic at the edge already
 *      knows the visitor's zone and forwards it — Vercel as
 *      `x-vercel-ip-timezone`, Cloudflare as `cf-timezone`. Free and instant.
 *   2. An IP-geolocation lookup, for hosts that inject no geo header. The real
 *      client IP is taken from `x-forwarded-for` (the first hop) or `x-real-ip`,
 *      and the answer is CACHED per IP so a visitor polling live scores costs
 *      one lookup, not one per poll. Several providers are tried in turn,
 *      because the free tiers rate-limit per CALLING ip — and on serverless
 *      every invocation egresses from a small pool of addresses, so one provider
 *      throttling the whole deployment is the expected case, not an edge case.
 *
 * When neither succeeds, `resolved` is false and the configured
 * `DISPLAY_TIMEZONE` stands in. That is a deliberate, deterministic default that
 * the server and client agree on, rather than a per-visitor guess read off their
 * hardware. Set `TIMEZONE_ALLOW_DEVICE_FALLBACK=1` to let the browser's own zone
 * take over in that case instead (see components/timezone-provider.tsx).
 *
 * Every lookup is best-effort with a short timeout: geolocation must never delay
 * or fail a page render, so any error just leaves `resolved` false.
 */
export interface ResolvedTimezone {
  /** The zone to render with on the server. */
  timezone: string;
  /** True when it came from the IP/geo headers, false when it is the fallback. */
  resolved: boolean;
  /** Which source answered, for diagnostics. */
  source: string;
}

/** Timezone plus a trusted clock: everything time-related about a request. */
export interface RequestTime extends ResolvedTimezone {
  /** True UTC in seconds — see lib/true-time.ts, never the host clock. */
  nowUnix: number;
  /** "YYYY-MM-DD" for right now, in the resolved zone. */
  today: string;
  /**
   * How many seconds the host's system clock is off by, or null if unknown.
   * Non-zero means the machine's own time is wrong and the correction is doing
   * work — worth surfacing, because it is otherwise invisible.
   */
  hostClockOffsetSeconds: number | null;
}

/**
 * The full time context for a request: which zone to render in, and what time
 * it actually is.
 *
 * These belong together. Both must come from OUTSIDE the machine, and both are
 * resolved over the network from the visitor's connection — the zone from their
 * IP, the clock from an external authority (lib/true-time.ts). Getting the zone
 * from the network but the clock from `Date.now()` is a half fix: a wrong system
 * clock puts "today" on the wrong date and every live minute out by the skew, no
 * matter how correct the timezone is.
 *
 * Server entry points should prefer this over calling `todayKey()` directly, so
 * the clock is guaranteed to be synced before the date is computed.
 */
export async function resolveRequestTime(): Promise<RequestTime> {
  // Both are network lookups with no dependency on each other, so overlap them
  // rather than paying for them back to back on a cold process.
  const [zone] = await Promise.all([
    resolveTimezoneFromRequest(),
    ensureTrueTime(),
  ]);

  return {
    ...zone,
    nowUnix: nowUnix(),
    today: toDateKey(nowDate(), zone.timezone),
    hostClockOffsetSeconds: hostClockOffsetSeconds(),
  };
}

export async function resolveTimezoneFromRequest(): Promise<ResolvedTimezone> {
  const h = await headers();

  // 1. Edge/platform geo headers. The host already geolocated the connection
  //    while terminating it, so this costs nothing and cannot be rate-limited.
  const headerZone =
    h.get("x-vercel-ip-timezone") || // Vercel
    h.get("cf-timezone"); //            Cloudflare
  if (isValidTimezone(headerZone)) {
    return { timezone: headerZone, resolved: true, source: "edge-header" };
  }

  // 1b. Netlify encodes the same geolocation as base64 JSON. Read
  //     opportunistically: if the runtime forwards it we get the zone free, and
  //     if it does not, this is one absent header lookup.
  const netlifyZone = netlifyGeoTimezone(h.get("x-nf-geo"));
  if (isValidTimezone(netlifyZone)) {
    return { timezone: netlifyZone, resolved: true, source: "netlify-geo" };
  }

  // 2. IP geolocation of the visitor's forwarded IP (production behind a proxy).
  const ip = clientIpFrom(h.get("x-forwarded-for"), h.get("x-real-ip"));
  if (ip) {
    const zone = await cachedLookup(ip);
    if (isValidTimezone(zone)) {
      return { timezone: zone, resolved: true, source: "ip-lookup" };
    }
  }

  /**
   * 3. Local development only: geolocate the SERVER's own public IP.
   *
   * On localhost the request IP is 127.0.0.1, so there is no visitor IP to look
   * up and steps 1 and 2 cannot fire. Looking up our own address instead makes a
   * dev session show the machine's real location rather than falling back — which
   * is what makes the zone correct while developing.
   *
   * DEV ONLY, and that restriction is the point. Deployed, "the server's own IP"
   * is the hosting region, so this would quietly hand every visitor whose
   * forwarded IP was missing or private the timezone of a datacenter in Virginia
   * — a confidently wrong answer, and worse than the configured default, because
   * `resolved: true` claims it came from the visitor. Set
   * GEO_TIMEZONE_SELF_LOOKUP=force to enable it in production anyway (useful if
   * the server genuinely sits near its users), or =off to disable it in dev too.
   */
  const selfLookup = process.env.GEO_TIMEZONE_SELF_LOOKUP;
  const selfLookupAllowed =
    selfLookup === "force" ||
    (selfLookup !== "off" && process.env.NODE_ENV !== "production");

  if (selfLookupAllowed) {
    const zone = await cachedLookup("");
    if (isValidTimezone(zone)) {
      return { timezone: zone, resolved: true, source: "self-ip-lookup" };
    }
  }

  // 4. Could not resolve from the connection at all. The configured default
  //    stands in — a deterministic value the server and client agree on.
  return { timezone: FALLBACK_TIMEZONE, resolved: false, source: "fallback" };
}

/**
 * Netlify's `x-nf-geo`: base64-encoded JSON of the same object its function
 * `Context.geo` exposes, i.e. `{ timezone, country: { code }, city, ... }`.
 */
function netlifyGeoTimezone(header: string | null): string | null {
  if (!header) return null;
  try {
    const json = JSON.parse(
      Buffer.from(header, "base64").toString("utf8"),
    ) as { timezone?: string };
    return typeof json.timezone === "string" ? json.timezone : null;
  } catch {
    return null;
  }
}

/**
 * Zone for an IP, cached in-process.
 *
 * Two things make this necessary rather than nice to have. A visitor watching
 * live scores re-polls every LIVE_POLL_SECONDS, and each poll is a fresh server
 * request that would otherwise geolocate the same IP again — so the lookup rate
 * scales with poll traffic, not with visitors. And the free geo tiers limit by
 * CALLING address: on serverless every invocation leaves from a small pool of
 * egress IPs, so the whole deployment shares one quota and burns it quickly.
 *
 * Caching per IP collapses that to one lookup per visitor per TTL. A negative
 * result is cached too, briefly, so an outage does not mean a doomed lookup on
 * every request.
 */
const GEO_TTL_MS = 12 * 60 * 60 * 1000;
const GEO_NEGATIVE_TTL_MS = 5 * 60 * 1000;

interface GeoEntry {
  zone: string | null;
  atMs: number;
}

const globalGeo = globalThis as typeof globalThis & {
  __jadwelGeo?: Map<string, GeoEntry>;
};

function geoCache(): Map<string, GeoEntry> {
  globalGeo.__jadwelGeo ??= new Map();
  return globalGeo.__jadwelGeo;
}

async function cachedLookup(ip: string): Promise<string | null> {
  const cache = geoCache();
  const hit = cache.get(ip);
  // Uses the trusted clock so a system-clock jump cannot make every entry look
  // expired (or permanently fresh) — the same reasoning as lib/cache.ts.
  const now = nowDate().getTime();

  if (hit) {
    const ttl = hit.zone ? GEO_TTL_MS : GEO_NEGATIVE_TTL_MS;
    if (now - hit.atMs < ttl) return hit.zone;
  }

  const zone = await lookupTimezoneByIp(ip);
  cache.set(ip, { zone, atMs: now });

  // Bound the map so a long-running instance cannot accumulate one entry per
  // visitor forever. Oldest-inserted goes first; Map preserves insertion order.
  if (cache.size > 5_000) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }

  return zone;
}

/**
 * The originating client IP from the standard proxy headers.
 *
 * `x-forwarded-for` is a comma-separated chain, client first, so the first
 * public entry is the visitor. Private and loopback ranges are rejected because
 * they cannot be geolocated (a local dev request, or a request that never left
 * the private network).
 */
function clientIpFrom(
  forwardedFor: string | null,
  realIp: string | null,
): string | null {
  const candidates = [
    ...(forwardedFor ? forwardedFor.split(",") : []),
    ...(realIp ? [realIp] : []),
  ].map((value) => value.trim());

  for (const ip of candidates) {
    if (ip && !isPrivateIp(ip)) return ip;
  }
  return null;
}

/** True for loopback, RFC-1918 and link-local addresses (not geolocatable). */
function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip === "127.0.0.1" || ip.startsWith("127.")) return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  // 172.16.0.0 – 172.31.255.255
  const m = /^172\.(\d{1,3})\./.exec(ip);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/**
 * IP-to-timezone endpoints, tried in order. `{ip}` is the placeholder; with it
 * empty the service geolocates the CALLER, which is what the dev-mode self
 * lookup relies on.
 *
 * More than one on purpose. Every keyless geo service rate-limits by calling
 * address, and a serverless deployment presents a handful of egress IPs for all
 * of its traffic, so hitting one provider's limit is routine. A single provider
 * meant that moment silently downgraded the zone for every visitor at once; with
 * a second, the next request simply asks someone else.
 *
 * `ipwho.is` leads because it is HTTPS. `ip-api.com` is kept as the follow-up
 * despite being HTTP-only on the free tier: it is a server-side lookup of
 * non-sensitive geo data, and having a second independent provider is worth more
 * than the scheme here. `GEO_TIMEZONE_LOOKUP_URL` prepends a custom endpoint
 * (paid, HTTPS or self-hosted) without touching this list.
 */
const GEO_ENDPOINTS: readonly string[] = [
  ...(process.env.GEO_TIMEZONE_LOOKUP_URL
    ? [process.env.GEO_TIMEZONE_LOOKUP_URL]
    : []),
  "https://ipwho.is/{ip}?fields=timezone",
  "http://ip-api.com/json/{ip}?fields=timezone",
];

/**
 * Timezone for a public IP, from the first geo service that answers.
 *
 * A response is accepted whether it is a bare zone string, or JSON carrying the
 * zone under `timezone` as a string (ip-api) or an object with `.id` (ipwho.is).
 * Best-effort throughout: a short timeout and try/catch per endpoint mean
 * geolocation can never stall or break a render.
 */
async function lookupTimezoneByIp(ip: string): Promise<string | null> {
  for (const template of GEO_ENDPOINTS) {
    const url = template.replace("{ip}", encodeURIComponent(ip));
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2_500),
        // Results are cached by `cachedLookup` above, keyed on the IP, so the
        // framework cache is not asked to do it as well. `no-store` keeps a
        // rate-limit error response from being persisted and replayed.
        cache: "no-store",
      });
      if (!response.ok) continue;
      const zone = extractZone((await response.text()).trim());
      if (isValidTimezone(zone)) return zone;
    } catch {
      // Timeout, DNS failure, throttling: fall through to the next provider.
    }
  }
  return null;
}

/** Pull an IANA zone out of a plain-text or JSON geolocation response. */
function extractZone(body: string): string | null {
  if (!body) return null;
  // A bare zone string, e.g. "Europe/London".
  if (!body.startsWith("{")) return body;
  try {
    const data = JSON.parse(body) as {
      timezone?: string | { id?: string };
    };
    const tz = data.timezone;
    if (typeof tz === "string") return tz;
    if (tz && typeof tz === "object" && typeof tz.id === "string") return tz.id;
    return null;
  } catch {
    return null;
  }
}

/** True when the string is a timezone Intl actually recognises. */
function isValidTimezone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    // Throws RangeError for an unknown zone.
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
