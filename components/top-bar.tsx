"use client";

import { t } from "@/lib/i18n";

interface TopBarProps {
  searchOpen: boolean;
  query: string;
  onToggleSearch: () => void;
  onQueryChange: (value: string) => void;
}

/** Logo, page title and a search toggle. No ads, banners or promo slots. */
export function TopBar({
  searchOpen,
  query,
  onToggleSearch,
  onQueryChange,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
        {/* JDWAL wordmark. The image is on a dark background that blends into the
            header, so it reads as a transparent logo. Fixed height, auto width,
            so it never distorts. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt={t.logoAlt}
          className="h-7 w-auto shrink-0 select-none sm:h-8"
        />

        <h1 className="flex-1 truncate text-end text-sm font-semibold text-muted">
          {t.allMatches}
        </h1>

        <button
          type="button"
          onClick={onToggleSearch}
          aria-label={searchOpen ? t.clearSearch : t.search}
          aria-expanded={searchOpen}
          className={`flex size-9 items-center justify-center rounded-full transition-colors ${
            searchOpen
              ? "bg-accent-soft text-accent"
              : "text-muted hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          {searchOpen ? <CloseIcon /> : <SearchIcon />}
        </button>
      </div>

      {searchOpen && (
        <div className="px-3 pb-3 sm:px-4">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-dim focus:border-accent focus:outline-none"
          />
        </div>
      )}
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className="size-5"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
