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
        "no-print inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition " +
        (active
          ? "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-200"
          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800")
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
