"use client";

import { useState } from "react";
import { flagEmoji } from "@/lib/countries";

interface CrestProps {
  src: string | null;
  name: string;
  /** Pixel size; the box is fixed so a slow or broken image never shifts layout. */
  size?: number;
  className?: string;
}

/**
 * Team or league crest with a graceful fallback.
 *
 * Plain <img> rather than next/image: these are tiny static PNGs on the
 * provider's CDN, so the optimizer adds cost without benefit, and a 404 here
 * must degrade to initials instead of a broken-image icon.
 */
export function Crest({ src, name, size = 26, className = "" }: CrestProps) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };

  if (!src || failed) {
    return (
      <span
        style={box}
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-surface-raised text-[0.6rem] font-semibold text-muted-dim ${className}`}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      style={box}
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

function initials(name: string): string {
  const clean = name.trim();
  if (!clean) return "?";
  return clean.slice(0, 2);
}

interface FlagProps {
  code: string | null;
  className?: string;
}

/** Country flag emoji; renders nothing when the country is unknown. */
export function Flag({ code, className = "" }: FlagProps) {
  const emoji = flagEmoji(code);
  if (!emoji) return null;
  return (
    <span
      aria-hidden="true"
      className={`shrink-0 text-[0.85em] leading-none ${className}`}
    >
      {emoji}
    </span>
  );
}
