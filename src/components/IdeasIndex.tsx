"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildIdeaPreview,
  formatRelativeTime,
  readFavorites,
  readPreviousIdeas,
  recordPreviousIdea,
} from "@/lib/idea-history";

type IdeaStatus = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  analysis_started_at: string | null;
  analysis_finished_at: string | null;
  raw_text_preview: string;
};

type StatusBadge = {
  label: string;
  tone: "queued" | "running" | "done" | "failed";
};

function describe(status: string): StatusBadge {
  switch (status) {
    case "done":
    case "ready":
      return { label: "Ready", tone: "done" };
    case "running":
    case "processing":
      return { label: "Analyzing…", tone: "running" };
    case "failed":
    case "error":
      return { label: "Failed", tone: "failed" };
    case "queued":
    default:
      return { label: "Queued", tone: "queued" };
  }
}

const TONE_CLASS: Record<StatusBadge["tone"], string> = {
  done:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  running:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  queued: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const POLL_INTERVAL_MS = 3000;

export default function IdeasIndex({
  submittedIds,
}: {
  submittedIds: string[];
}) {
  const [hydrated, setHydrated] = useState(false);
  const [knownIds, setKnownIds] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, IdeaStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const submittedIdsKey = useMemo(() => submittedIds.join(","), [submittedIds]);
  const isMountedRef = useRef(true);

  // Hydration: combine ids from URL with localStorage history.
  useEffect(() => {
    isMountedRef.current = true;
    const fromHistory = readPreviousIdeas().map((e) => e.id);
    const merged = Array.from(new Set([...submittedIds, ...fromHistory]));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration read from localStorage; SSR can't see it
    setKnownIds(merged);
    setFavorites(readFavorites());
    setHydrated(true);
    return () => {
      isMountedRef.current = false;
    };
  }, [submittedIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStatuses = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const res = await fetch(`/api/ideas?ids=${encodeURIComponent(ids.join(","))}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const body = (await res.json()) as { ideas: IdeaStatus[] };
      if (!isMountedRef.current) return;
      setStatuses((prev) => {
        const next: Record<string, IdeaStatus> = { ...prev };
        for (const idea of body.ideas) {
          next[idea.id] = idea;
        }
        return next;
      });
      // Record any newly-seen ideas in localStorage so refresh-to-resume works.
      for (const idea of body.ideas) {
        recordPreviousIdea({
          id: idea.id,
          ideaPreview: buildIdeaPreview(idea.raw_text_preview),
          submittedAt: idea.created_at,
        });
      }
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const statusesRef = useRef(statuses);

  // Keep the ref in sync via an effect so we don't write during render.
  useEffect(() => {
    statusesRef.current = statuses;
  }, [statuses]);

  // Poll loop. Stops when all ideas reach a terminal state but resumes if
  // the page is left open and knownIds changes.
  useEffect(() => {
    if (!hydrated || knownIds.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const allTerminal = () =>
      knownIds.every((id) => {
        const s = statusesRef.current[id]?.status;
        return s === "done" || s === "ready" || s === "failed" || s === "error";
      });
    const runPoll = async () => {
      if (cancelled) return;
      await fetchStatuses(knownIds);
      if (cancelled) return;
      if (!allTerminal()) {
        timer = setTimeout(runPoll, POLL_INTERVAL_MS);
      }
    };
    // Defer the initial fetch by a microtask so we don't trigger setState
    // synchronously inside the effect body.
    timer = setTimeout(runPoll, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hydrated, knownIds, fetchStatuses]);

  if (!hydrated) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
    );
  }
  if (knownIds.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
        No ideas yet. <Link href="/" className="underline">Submit one</Link>.
      </section>
    );
  }

  const ordered = [...knownIds].sort((a, b) => {
    const ta = statuses[a]?.created_at ?? "";
    const tb = statuses[b]?.created_at ?? "";
    return tb.localeCompare(ta);
  });

  const submittedSet = new Set(submittedIds);
  const favSet = new Set(favorites);
  const submittedOrdered = ordered.filter((id) => submittedSet.has(id));
  const favoriteOrdered = ordered.filter(
    (id) => !submittedSet.has(id) && favSet.has(id),
  );
  const otherOrdered = ordered.filter(
    (id) => !submittedSet.has(id) && !favSet.has(id),
  );

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Status update failed: {error} (will retry)
        </p>
      ) : null}
      {submittedOrdered.length > 0 ? (
        <Section title="Just submitted" ids={submittedOrdered} statuses={statuses} />
      ) : null}
      {favoriteOrdered.length > 0 ? (
        <Section
          title="Favorites"
          ids={favoriteOrdered}
          statuses={statuses}
          starred
        />
      ) : null}
      {otherOrdered.length > 0 ? (
        <Section
          title="Previous ideas"
          ids={otherOrdered}
          statuses={statuses}
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  ids,
  statuses,
  starred = false,
}: {
  title: string;
  ids: string[];
  statuses: Record<string, IdeaStatus>;
  starred?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
        {ids.map((id) => {
          const idea = statuses[id];
          const badge = idea ? describe(idea.status) : { label: "…", tone: "queued" as const };
          const previewSource = idea?.raw_text_preview ?? "";
          const preview = previewSource ? buildIdeaPreview(previewSource) : "(loading…)";
          const submittedAt = idea?.created_at;
          return (
            <li key={id}>
              <Link
                href={`/ideas/${id}`}
                className="flex items-start gap-3 py-2 text-sm text-zinc-800 transition hover:text-black dark:text-zinc-200 dark:hover:text-white"
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
                ) : null}
                <span className="flex-1 truncate">{preview}</span>
                <span
                  className={
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                    TONE_CLASS[badge.tone]
                  }
                >
                  {badge.label}
                </span>
                <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                  {submittedAt ? formatRelativeTime(submittedAt) : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
