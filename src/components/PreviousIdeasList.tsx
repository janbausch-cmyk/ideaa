"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  formatRelativeTime,
  readFavorites,
  readPreviousIdeas,
  type PreviousIdeaEntry,
} from "@/lib/idea-history";

export default function PreviousIdeasList() {
  const [entries, setEntries] = useState<PreviousIdeaEntry[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration read from localStorage; SSR can't see it
    setEntries(readPreviousIdeas());
    setFavorites(readFavorites());
    setHydrated(true);
  }, []);

  if (!hydrated || entries.length === 0) return null;

  const favSet = new Set(favorites);
  const favoriteEntries = entries.filter((e) => favSet.has(e.id));
  const previousEntries = entries.filter((e) => !favSet.has(e.id));

  return (
    <div className="flex flex-col gap-4">
      {favoriteEntries.length > 0 ? (
        <Section
          title="Your favorites"
          entries={favoriteEntries}
          starred
        />
      ) : null}
      {previousEntries.length > 0 ? (
        <Section title="Your previous ideas" entries={previousEntries} />
      ) : null}
    </div>
  );
}

function Section({
  title,
  entries,
  starred = false,
}: {
  title: string;
  entries: PreviousIdeaEntry[];
  starred?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link
              href={`/ideas/${entry.id}`}
              className="flex items-start gap-2 py-2 text-sm text-zinc-800 transition hover:text-black dark:text-zinc-200 dark:hover:text-white"
            >
              {starred ? (
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 shrink-0 text-amber-500"
                >
                  <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
                </svg>
              ) : null}
              <span className="flex-1 truncate">
                {entry.ideaPreview || "(no preview)"}
              </span>
              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                {formatRelativeTime(entry.submittedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
