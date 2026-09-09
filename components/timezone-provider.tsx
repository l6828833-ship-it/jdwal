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
 * Supplies the timezone every date and kickoff time is rendered in.
 *
 * IP is the primary source: the server resolves the visitor's zone from their
 * IP and passes it as `serverTimezone` with `resolvedFromIp = true`, and that
 * value is used verbatim — the browser's device setting is not consulted, so
 * times follow the visitor's network location.
 *
 * The browser is the FALLBACK: when the IP could not be resolved
 * (`resolvedFromIp = false` — e.g. a local request with no public IP), the
 * client reads its own zone via `useSyncExternalStore`. Hydration renders the
 * server fallback first, then React swaps to the browser's zone with no
 * mismatch. When the IP was resolved, there is nothing to subscribe to and no
 * swap.
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
  const browserTimezone = useSyncExternalStore(
    subscribe,
    // Client: the browser zone, used only as the fallback.
    getBrowserTimezone,
    // Server: the value it rendered with.
    () => serverTimezone,
  );

  // IP wins when it resolved; otherwise fall back to the browser's zone.
  const timezone = resolvedFromIp ? serverTimezone : browserTimezone;

  return (
    <TimezoneContext.Provider value={timezone}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone(): string {
  return useContext(TimezoneContext);
}
