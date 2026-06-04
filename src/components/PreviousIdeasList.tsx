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
          title="Deine Favoriten"
          entries={favoriteEntries}
          starred
        />
      ) : null}
      {previousEntries.length > 0 ? (
        <Section title="Deine früheren Ideen" entries={previousEntries} />
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
    <section className="surface-card flex flex-col gap-2 p-5">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">{title}</h2>
        <span className="text-[11px] text-[color:var(--foreground-muted)]">
          {entries.length} {entries.length === 1 ? "Idee" : "Ideen"}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-[color:var(--border)]">
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link
              href={`/ideas/${entry.id}`}
              className="group flex items-start gap-3 py-3 text-sm text-[color:var(--foreground)] transition hover:text-[color:var(--brand-ink)]"
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
                  className="mt-1 shrink-0 text-amber-500"
                >
                  <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
                </svg>
              ) : (
                <span
                  aria-hidden
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--border-strong)] group-hover:bg-[color:var(--brand-ink)]"
                />
              )}
              <span className="flex-1 truncate">
                {entry.ideaPreview || "(keine Vorschau)"}
              </span>
              <span className="shrink-0 text-xs text-[color:var(--foreground-muted)]">
                {formatRelativeTime(entry.submittedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
