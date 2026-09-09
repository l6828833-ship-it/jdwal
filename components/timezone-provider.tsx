"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { FALLBACK_TIMEZONE, detectTimezone } from "@/lib/date";

const TimezoneContext = createContext<string>(FALLBACK_TIMEZONE);

/** The zone never changes during a session, so there is nothing to subscribe to. */
const subscribe = () => () => {};

/** Cached so getSnapshot returns a referentially stable value on every call. */
let cachedTimezone: string | null = null;

function getBrowserTimezone(): string {
  cachedTimezone ??= detectTimezone() ?? FALLBACK_TIMEZONE;
  return cachedTimezone;
}

/**
 * Whether the browser's own zone may stand in when the IP could not be resolved.
 *
 * Off by default: the device is not a source of truth here. Its zone is only as
 * accurate as whoever last configured the machine, and a wrong one silently
 * shifts every kickoff time and can open the app on the wrong day — the failure
 * looks like a bug in the app, not a setting on the computer. A deterministic
 * configured default is easier to reason about and identical on both sides of
 * hydration.
 *
 * `NEXT_PUBLIC_TIMEZONE_ALLOW_DEVICE_FALLBACK=1` restores the old behaviour for
 * a deployment that would rather have the device's guess than a fixed default —
 * reasonable if the audience is geographically spread and mostly behind
 * networks that geolocate poorly.
 */
const ALLOW_DEVICE_FALLBACK =
  process.env.NEXT_PUBLIC_TIMEZONE_ALLOW_DEVICE_FALLBACK === "1";

/**
 * Supplies the timezone every date and kickoff time is rendered in.
 *
 * The zone comes from the visitor's IP, resolved on the server (see
 * lib/geo-timezone.ts) and passed down as `serverTimezone` with
 * `resolvedFromIp = true`. It is used verbatim; the device's own setting is
 * never consulted.
 *
 * When the IP could not be resolved (`resolvedFromIp = false`), the server's
 * configured default is kept rather than swapping in the browser's zone, unless
 * `ALLOW_DEVICE_FALLBACK` is on. Keeping it means the value is identical on the
 * server and the client, so there is no hydration mismatch and no visible jump
 * from one zone to another after the page has already painted.
 */
export function TimezoneProvider({
  children,
  serverTimezone = FALLBACK_TIMEZONE,
  resolvedFromIp = false,
}: {
  children: React.ReactNode;
  serverTimezone?: string;
  resolvedFromIp?: boolean;
}) {
  /**
   * Read only when the device is actually allowed to be the fallback. Calling
   * `useSyncExternalStore` unconditionally keeps hook order stable; when the
   * device is not permitted, its value is simply never used.
   */
  const browserTimezone = useSyncExternalStore(
    subscribe,
    // Client: the browser's zone.
    getBrowserTimezone,
    // Server: the value it rendered with.
    () => serverTimezone,
  );

  const timezone =
    resolvedFromIp || !ALLOW_DEVICE_FALLBACK ? serverTimezone : browserTimezone;

  return (
    <TimezoneContext.Provider value={timezone}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone(): string {
  return useContext(TimezoneContext);
}
