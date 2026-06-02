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
      return { label: "Fertig", tone: "done" };
    case "running":
    case "processing":
      return { label: "Wird analysiert…", tone: "running" };
    case "failed":
    case "error":
      return { label: "Fehlgeschlagen", tone: "failed" };
    case "queued":
    default:
      return { label: "In Warteschlange", tone: "queued" };
  }
}

const TONE_CLASS: Record<StatusBadge["tone"], string> = {
  done:
    "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/70 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-700/40",
  running:
    "bg-amber-100 text-amber-800 ring-1 ring-amber-200/70 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-700/40",
  failed:
    "bg-rose-100 text-rose-800 ring-1 ring-rose-200/70 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-700/40",
  queued:
    "bg-[color:var(--surface-muted)] text-[color:var(--foreground-muted)] ring-1 ring-[color:var(--border)]",
};

const TONE_DOT: Record<StatusBadge["tone"], string> = {
  done: "bg-emerald-500",
  running: "bg-amber-500 animate-pulse",
  failed: "bg-rose-500",
  queued: "bg-zinc-400 dark:bg-zinc-500",
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
      <p className="text-sm text-[color:var(--foreground-muted)]">Lädt…</p>
    );
  }
  if (knownIds.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] p-8 text-center text-sm text-[color:var(--foreground-muted)]">
        Noch keine Ideen.{" "}
        <Link
          href="/validieren"
          className="font-medium text-[color:var(--brand-ink)] underline-offset-2 hover:underline"
        >
          Reiche eine ein
        </Link>
        .
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
        <p className="rounded-xl border border-rose-300/70 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
          Statusaktualisierung fehlgeschlagen: {error} (wird erneut versucht)
        </p>
      ) : null}
      {submittedOrdered.length > 0 ? (
        <Section title="Gerade eingereicht" ids={submittedOrdered} statuses={statuses} />
      ) : null}
      {favoriteOrdered.length > 0 ? (
        <Section
          title="Favoriten"
          ids={favoriteOrdered}
          statuses={statuses}
          starred
        />
      ) : null}
      {otherOrdered.length > 0 ? (
        <Section
          title="Frühere Ideen"
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
    <section className="surface-card flex flex-col gap-1 p-5">
      <div className="flex items-center justify-between pb-1">
        <h2 className="eyebrow">{title}</h2>
        <span className="text-[11px] text-[color:var(--foreground-muted)]">
          {ids.length} {ids.length === 1 ? "Idee" : "Ideen"}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-[color:var(--border)]">
        {ids.map((id) => {
          const idea = statuses[id];
          const badge = idea ? describe(idea.status) : { label: "…", tone: "queued" as const };
          const previewSource = idea?.raw_text_preview ?? "";
          const preview = previewSource ? buildIdeaPreview(previewSource) : "(lädt…)";
          const submittedAt = idea?.created_at;
          return (
            <li key={id}>
              <Link
                href={`/ideas/${id}`}
                className="group flex items-center gap-3 py-3 text-sm text-[color:var(--foreground)] transition hover:text-[color:var(--brand-ink)]"
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
                    className="shrink-0 text-amber-500"
                  >
                    <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9 12 2" />
                  </svg>
                ) : null}
                <span className="flex-1 truncate">{preview}</span>
                <span
                  className={
                    "shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                    TONE_CLASS[badge.tone]
                  }
                >
                  <span
                    aria-hidden
                    className={
                      "h-1.5 w-1.5 rounded-full " + TONE_DOT[badge.tone]
                    }
                  />
                  {badge.label}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-[color:var(--foreground-muted)]">
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
