"use client";

import { useEffect, useState } from "react";

import { isFavorite, toggleFavorite } from "@/lib/idea-history";

export default function FavoriteButton({ id }: { id: string }) {
  const [active, setActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration read from localStorage; SSR can't see it
    setActive(isFavorite(id));
    setHydrated(true);
  }, [id]);

  function onClick() {
    const next = toggleFavorite(id);
    setActive(next);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? "Remove from favorites" : "Save as good"}
      className={
        "no-print inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition " +
        (active
          ? "border-amber-400/70 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/60 dark:bg-amber-950/50 dark:text-amber-200"
          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:border-[color:var(--brand-ink)]/40 hover:text-[color:var(--brand-ink)]")
      }
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
      </svg>
      <span>{hydrated && active ? "Saved" : "Save as good"}</span>
    </button>
  );
}
