// Server-only by construction: it imports `next/headers`, which throws if pulled
// into a client bundle. No `server-only` package needed to enforce that.
import { headers } from "next/headers";
import { FALLBACK_TIMEZONE } from "./date";

/**
 * The visitor's IANA timezone, resolved on the server from their IP.
 *
 * Why the server does this at all when the browser already knows its own zone:
 * the very first paint is server-rendered, before any client JS runs, so
 * without a server guess that first render uses one fixed zone for everyone and
 * "today" can be a day off for a visitor far away until hydration corrects it.
 * Resolving from the request here makes the first paint already correct.
 *
 * Resolution order, cheapest and most reliable first:
 *
 *   1. Platform geo headers. A host that terminates traffic at the edge already
 *      knows the visitor's zone and forwards it — Vercel as
 *      `x-vercel-ip-timezone`, Cloudflare as `cf-timezone`. Free and instant.
 *   2. An IP-geolocation lookup, for hosts that inject no geo header. The real
 *      client IP is taken from `x-forwarded-for` (the first hop) or
 *      `x-real-ip`. Private/loopback IPs are skipped — a dev machine has no
 *      public IP to geolocate — so local runs cannot resolve here.
 *
 * When neither succeeds, `resolved` is false: the caller renders the configured
 * fallback for the server paint, and the browser's own zone takes over on
 * hydration. So IP is the primary source, the browser is the fallback, and the
 * configured default is only the last resort before the browser reports in.
 *
 * The lookup is best-effort with a short timeout: geolocation must never delay
 * or fail a page render, so any error just leaves `resolved` false.
 */
export interface ResolvedTimezone {
  /** The zone to render with on the server. */
  timezone: string;
  /** True when it came from the IP/geo headers, false when it is the fallback. */
  resolved: boolean;
}

export async function resolveTimezoneFromRequest(): Promise<ResolvedTimezone> {
  const h = await headers();

  // 1. Edge/platform geo headers.
  const headerZone =
    h.get("x-vercel-ip-timezone") || // Vercel
    h.get("cf-timezone"); //            Cloudflare
  if (isValidTimezone(headerZone)) {
    return { timezone: headerZone, resolved: true };
  }

  // 2. IP geolocation of the visitor's forwarded IP (production behind a proxy).
  const ip = clientIpFrom(h.get("x-forwarded-for"), h.get("x-real-ip"));
  if (ip) {
    const zone = await lookupTimezoneByIp(ip);
    if (isValidTimezone(zone)) return { timezone: zone, resolved: true };
  }

  // 3. Local development: the request IP is private (127.0.0.1), so there is no
  //    visitor IP to geolocate. Instead of trusting the browser clock — which
  //    on a misconfigured machine reports the wrong zone — geolocate the
  //    server's OWN public IP by calling the lookup with no IP. This makes a
  //    localhost session show the machine's real location. Skippable via
  //    GEO_TIMEZONE_SELF_LOOKUP=off for a deployment that must never do it.
  if (process.env.GEO_TIMEZONE_SELF_LOOKUP !== "off") {
    const zone = await lookupTimezoneByIp("");
    if (isValidTimezone(zone)) return { timezone: zone, resolved: true };
  }

  // 4. Could not resolve from IP at all — the browser supplies the zone on the
  //    client; the fallback only governs the pre-hydration server paint.
  return { timezone: FALLBACK_TIMEZONE, resolved: false };
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
 * Timezone for a public IP, from a free geolocation service.
 *
 * Default is `ip-api.com`, which returns `{"timezone":"Europe/London"}` with no
 * key and a generous free allowance (its free tier is HTTP-only, acceptable for
 * a server-side lookup of non-sensitive geo data). The endpoint is overridable
 * via `GEO_TIMEZONE_LOOKUP_URL` (use `{ip}` as the placeholder) so a paid,
 * HTTPS, or self-hosted geo service can be swapped in without code changes.
 *
 * The response is accepted whether it is a bare zone string (some services) or
 * JSON carrying the zone under `timezone` (a string, or an object with `.id`
 * as ipwho.is returns). Best-effort throughout: a 2s timeout and try/catch mean
 * geolocation can never stall or break a render.
 */
async function lookupTimezoneByIp(ip: string): Promise<string | null> {
  const template =
    process.env.GEO_TIMEZONE_LOOKUP_URL ||
    "http://ip-api.com/json/{ip}?fields=timezone";
  const url = template.replace("{ip}", encodeURIComponent(ip));
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(2_000),
      // Cache per IP for a day: a visitor's zone does not change mid-session,
      // and this keeps the free lookup well under any rate limit.
      next: { revalidate: 24 * 60 * 60 },
    });
    if (!response.ok) return null;
    const zone = extractZone((await response.text()).trim());
    return isValidTimezone(zone) ? zone : null;
  } catch {
    return null;
  }
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
