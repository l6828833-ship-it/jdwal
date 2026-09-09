/**
 * Server-side cache, request coalescing and monthly budget guard.
 *
 * Why this exists: the Footballdata.io free plan allows 1000 requests PER
 * MONTH. Polling live scores every 60s for a month would need ~43,000. So:
 *
 *  1. Every visitor shares one cache entry per key, so N browsers polling
 *     costs the same as one.
 *  2. Concurrent misses are coalesced into a single upstream call.
 *  3. A budget guard stops upstream traffic as the monthly quota is consumed
 *     and serves cached data instead, so the key is never burned dry.
 *
 * Quota accounting is authoritative, not estimated: every Footballdata.io
 * response carries `meta.requests_used` / `meta.requests_limit`, and that is
 * what the guard reads.
 *
 * Scope note: this cache is per server instance and in-memory. That is correct
 * for a single node or a long-lived container. On multi-instance serverless the
 * effective upstream rate multiplies by the instance count — move the cache and
 * the counter to Redis (or similar) before scaling out.
 */

import * as fs from "node:fs";
import { BUDGET_HARD_LIMIT_RATIO, BUDGET_SOFT_LIMIT_RATIO, MONTHLY_LIMIT } from "./config";
import { nowMs } from "./true-time";

/**
 * Timestamps here are TRUE UTC (lib/true-time.ts), not `Date.now()`.
 *
 * TTLs are durations, so they are only meaningful if both ends of the
 * subtraction come from a clock that moves at one rate. On a host whose system
 * clock is wrong — or gets corrected mid-session by NTP — `Date.now()` does not:
 * entries written before a jump appear either instantly expired or frozen fresh
 * forever, and the `ageSeconds` reported to the UI becomes fiction. Staying on
 * true UTC (rather than a monotonic counter) also keeps `fetchedAt` meaningful
 * across the disk snapshot below, which outlives the process.
 */
interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
  ttlMs: number;
}

interface BudgetState {
  used: number | null;
  limit: number;
  lastUpdated: number;
}

interface CacheStore {
  entries: Map<string, CacheEntry<unknown>>;
  inflight: Map<string, Promise<unknown>>;
  budget: BudgetState;
}

/**
 * Survive dev-server hot reloads so the cache and the quota counter aren't
 * reset on every file save (which would quietly drain the request budget).
 */
const globalStore = globalThis as typeof globalThis & {
  __jadwelCache?: CacheStore;
};

/**
 * Disk snapshot path. Persisting the cache means a full server RESTART (not
 * just a hot reload) doesn't re-fetch everything and re-spend the budget —
 * which is exactly how a day's quota gets burned during development.
 * Disabled in production serverless (read-only FS) by the try/catch.
 */
const DISK_PATH = ".next/cache/jadwel-cache.json";

function loadFromDisk(): CacheStore | null {
  try {
    if (!fs.existsSync(DISK_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(DISK_PATH, "utf8")) as {
      entries: Array<[string, CacheEntry<unknown>]>;
      budget: BudgetState;
    };
    return {
      entries: new Map(raw.entries),
      inflight: new Map(),
      budget: raw.budget,
    };
  } catch {
    return null;
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced write, so a burst of cache updates costs one disk write. */
function persistToDisk(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const s = globalStore.__jadwelCache;
      if (!s) return;
      fs.mkdirSync(".next/cache", { recursive: true });
      fs.writeFileSync(
        DISK_PATH,
        JSON.stringify({ entries: [...s.entries], budget: s.budget }),
      );
    } catch {
      // Read-only or serverless FS: in-memory cache still works.
    }
  }, 1000);
}

function store(): CacheStore {
  if (!globalStore.__jadwelCache) {
    globalStore.__jadwelCache =
      loadFromDisk() ?? {
        entries: new Map(),
        inflight: new Map(),
        budget: { used: null, limit: MONTHLY_LIMIT, lastUpdated: 0 },
      };
  }
  return globalStore.__jadwelCache;
}

/** Record the authoritative quota numbers reported by the provider. */
export function recordUpstreamUsage(
  used: number | null | undefined,
  limit: number | null | undefined,
): void {
  const s = store();
  if (typeof used === "number" && Number.isFinite(used)) {
    s.budget.used = used;
    s.budget.lastUpdated = nowMs();
  }
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    s.budget.limit = limit;
  }
  persistToDisk();
}

/**
 * Forget the recorded quota figures.
 *
 * The budget counter is persisted to disk, so it outlives a provider switch —
 * and a count carried over from a different backend would throttle requests
 * against a quota the new one does not share. A provider calls this once when
 * it takes over, then reports its own numbers via `recordUpstreamUsage`.
 *
 * With `used` back to null the guard is inert (`ratio` is 0), which is the
 * correct starting state for a backend whose allowance is not yet known.
 */
export function resetBudget(): void {
  const s = store();
  s.budget.used = null;
  s.budget.lastUpdated = 0;
  persistToDisk();
}

/** Optimistically count a request we are about to make. */
function incrementUsage(): void {
  const s = store();
  if (typeof s.budget.used === "number") s.budget.used += 1;
}

export function getBudget(): {
  used: number | null;
  limit: number;
  ratio: number;
  softBlocked: boolean;
  hardBlocked: boolean;
} {
  const s = store();
  const used = s.budget.used;
  const limit = s.budget.limit || MONTHLY_LIMIT;
  const ratio = typeof used === "number" ? used / limit : 0;
  return {
    used,
    limit,
    ratio,
    softBlocked: ratio >= BUDGET_SOFT_LIMIT_RATIO,
    hardBlocked: ratio >= BUDGET_HARD_LIMIT_RATIO,
  };
}

/**
 * "high"       — a user is actively waiting (initial load, opening a page).
 *                Allowed until the hard ceiling.
 * "normal"     — supporting reads (standings, player search). Stops at soft.
 * "background" — automated live polling. Stops at soft, FIRST to be cut, so a
 *                left-open tab can never lock a real user out of the budget.
 */
export type FetchPriority = "high" | "normal" | "background";

export interface CachedResult<T> {
  value: T;
  fromCache: boolean;
  ageSeconds: number;
  budgetBlocked: boolean;
  error?: string;
}

export interface GetCachedOptions {
  /** TTL in seconds. */
  ttlSeconds: number;
  /**
   * "high" survives the soft budget limit (live scores). "normal" is blocked
   * once the soft limit is hit and serves cache instead.
   */
  priority?: FetchPriority;
  /**
   * When true, a stale entry is returned rather than throwing if the upstream
   * call fails or is blocked. Defaults to true.
   */
  serveStaleOnError?: boolean;
}

/**
 * Read through the cache, coalescing concurrent misses and respecting the
 * monthly budget. Never throws when a stale entry exists.
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: GetCachedOptions,
): Promise<CachedResult<T>> {
  const s = store();
  const { ttlSeconds, priority = "normal", serveStaleOnError = true } = options;
  const now = nowMs();
  const entry = s.entries.get(key) as CacheEntry<T> | undefined;

  const ageSeconds = entry ? Math.round((now - entry.fetchedAt) / 1000) : 0;
  const isFresh = entry ? now - entry.fetchedAt < entry.ttlMs : false;

  if (entry && isFresh) {
    return { value: entry.value, fromCache: true, ageSeconds, budgetBlocked: false };
  }

  // Budget gate before spending a request.
  const budget = getBudget();
  const blocked =
    budget.hardBlocked || (budget.softBlocked && priority !== "high");

  if (blocked && entry) {
    return { value: entry.value, fromCache: true, ageSeconds, budgetBlocked: true };
  }
  if (blocked && !entry) {
    throw new BudgetExhaustedError(
      `Monthly request budget reached (${budget.used}/${budget.limit}) and no cached data for "${key}".`,
    );
  }

  // Coalesce: reuse an in-flight fetch for the same key.
  const existing = s.inflight.get(key) as Promise<T> | undefined;
  if (existing) {
    try {
      const value = await existing;
      return { value, fromCache: true, ageSeconds: 0, budgetBlocked: false };
    } catch (error) {
      if (entry && serveStaleOnError) {
        return {
          value: entry.value,
          fromCache: true,
          ageSeconds,
          budgetBlocked: false,
          error: errorMessage(error),
        };
      }
      throw error;
    }
  }

  const promise = (async () => {
    incrementUsage();
    const value = await fetcher();
    s.entries.set(key, { value, fetchedAt: nowMs(), ttlMs: ttlSeconds * 1000 });
    persistToDisk();
    return value;
  })();

  s.inflight.set(key, promise);

  try {
    const value = await promise;
    return { value, fromCache: false, ageSeconds: 0, budgetBlocked: false };
  } catch (error) {
    if (entry && serveStaleOnError) {
      return {
        value: entry.value,
        fromCache: true,
        ageSeconds,
        budgetBlocked: false,
        error: errorMessage(error),
      };
    }
    throw error;
  } finally {
    s.inflight.delete(key);
  }
}

export class BudgetExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExhaustedError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
