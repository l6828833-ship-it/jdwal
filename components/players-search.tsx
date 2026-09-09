"use client";

import { useEffect, useRef, useState } from "react";
import { Crest } from "./crest";
import { t } from "@/lib/i18n";
import type { PlayerSearchResult } from "@/lib/types";

/**
 * Player search by name.
 *
 * Deliberately a lookup, not a ranking: league leaderboards live on the league
 * page, where a competition and season give the numbers meaning.
 */
export function PlayersSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  /**
   * False when the backend has no player directory at all. Distinct from an
   * empty result set: "this source cannot search players" and "no player matches
   * that name" are different answers and must not share a message.
   */
  const [available, setAvailable] = useState(true);
  const seq = useRef(0);

  const trimmed = query.trim();
  const active = trimmed.length >= 2;

  useEffect(() => {
    if (!active) {
      // Query too short: nothing to fetch. State is reset in the input handler,
      // so the effect body stays purely a subscription to the debounced fetch.
      return;
    }

    const id = ++seq.current;
    let cancelled = false;

    const timer = setTimeout(async () => {
      // Spinner is set inside the debounced callback (after the delay), not in
      // the effect body, so a fast typer never sees it flash.
      if (!cancelled) setLoading(true);
      try {
        const res = await fetch(`/api/players?q=${encodeURIComponent(trimmed)}`, {
          cache: "no-store",
        });
        const body = (await res.json()) as {
          players?: PlayerSearchResult[];
          available?: boolean;
        };
        if (cancelled || id !== seq.current) return;
        setResults(body.players ?? []);
        setAvailable(body.available !== false);
        setSearched(true);
      } catch {
        if (!cancelled && id === seq.current) setResults([]);
      } finally {
        if (!cancelled && id === seq.current) setLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, active]);

  const onChange = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.playerSearchPlaceholder}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted-dim focus:border-accent focus:outline-none"
      />

      <div className="flex h-4 items-center justify-center" aria-live="polite">
        {loading && <span className="text-[0.68rem] text-muted-dim">···</span>}
      </div>

      {searched && !loading && results.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm leading-relaxed text-muted">
          {available ? t.noResults : t.playerSearchUnavailable}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((player) => (
            <li
              key={player.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
            >
              <Crest src={player.logo} name={player.name} size={32} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {player.fullName}
                </span>
                {/* Club first when known — it is the most useful
                    disambiguator for a common name. */}
                {player.team ? (
                  <span className="truncate text-[0.7rem] text-muted">
                    {player.team}
                  </span>
                ) : (
                  player.name !== player.fullName && (
                    <span className="truncate text-[0.7rem] text-muted">
                      {player.name}
                    </span>
                  )
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
