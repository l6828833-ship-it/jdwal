/**
 * Date helpers.
 *
 * All formatting is timezone-explicit and uses Latin digits with a fixed
 * pattern rather than locale-dependent output, so the server and the client
 * always produce byte-identical strings (no hydration mismatch, no flicker
 * when a polled update re-renders a row).
 */

import { DISPLAY_TIMEZONE } from "./config";

const AR_WEEKDAYS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

/** Formatters are expensive to construct, so cache one per timezone. */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * The timezone used when none is supplied — server rendering, before the
 * browser's own zone is known. `resolveTimezone` falls back to this.
 */
export const FALLBACK_TIMEZONE = DISPLAY_TIMEZONE;

/**
 * The viewer's timezone, detected from the browser.
 *
 * "Today" has to mean today where the user actually is. Pinning it to one zone
 * makes the app roll over to the next day early or late for everyone else.
 * Returns null on the server, where there is no viewer to ask.
 */
export function detectTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function resolveTimezone(timeZone?: string | null): string {
  return timeZone || FALLBACK_TIMEZONE;
}

/** Break a Date into calendar parts as seen in the given timezone. */
export function zonedParts(date: Date, timeZone?: string | null): ZonedParts {
  const parts = partsFormatter(resolveTimezone(timeZone)).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // "24" appears at midnight in some ICU versions; normalize it.
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for the given instant in the given timezone. */
export function toDateKey(date: Date, timeZone?: string | null): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Today's date key in the given timezone. */
export function todayKey(timeZone?: string | null): string {
  return toDateKey(new Date(), timeZone);
}

/** Shift a "YYYY-MM-DD" key by whole days, staying calendar-correct. */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  // Anchor at UTC noon so DST transitions can never roll the date over.
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return `${anchor.getUTCFullYear()}-${pad(anchor.getUTCMonth() + 1)}-${pad(
    anchor.getUTCDate(),
  )}`;
}

/** Whole-day difference between two date keys (b - a). */
export function dateKeyDiff(a: string, b: string): number {
  const parse = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(b) - parse(a)) / 86_400_000);
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** Arabic weekday name for a date key, e.g. "الثلاثاء". */
export function weekdayAr(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return AR_WEEKDAYS[dow];
}

/** "الثلاثاء، 08/09/2026" */
export function formatDateHeader(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${weekdayAr(key)}، ${pad(d)}/${pad(m)}/${y}`;
}

/** "8 سبتمبر 2026" */
export function formatDateLong(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${AR_MONTHS[m - 1]} ${y}`;
}

/** "دd/mm" short label for the date strip. */
export function formatDateShort(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${pad(d)}/${pad(m)}`;
}

/** Kickoff clock "19:00" in the given timezone. */
export function formatKickoff(
  unixSeconds: number,
  timeZone?: string | null,
): string {
  const p = zonedParts(new Date(unixSeconds * 1000), timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Parse the provider's "YYYY-MM-DD HH:MM:SS" timestamps.
 *
 * Footballdata.io reports these in UTC (confirmed against `date_unix`), and the
 * string carries no offset, so it is read as UTC explicitly rather than left to
 * the runtime's local-time interpretation.
 */
export function parseProviderDate(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(
    value,
  );
  if (!m) {
    const fallback = Date.parse(value);
    return Number.isNaN(fallback) ? null : Math.floor(fallback / 1000);
  }
  const [, y, mo, d, h, mi, s] = m;
  return Math.floor(
    Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0) / 1000,
  );
}
