"use client";

import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";

interface BackHeaderProps {
  title: string;
}

/** Sticky header with a back button. The chevron points right, as RTL expects. */
export function BackHeader({ title }: BackHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md sm:px-4">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label={t.back}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
    </header>
  );
}
