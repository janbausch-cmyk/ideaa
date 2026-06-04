"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 5000;

function isTerminal(status: string | null | undefined): boolean {
  if (!status) return false;
  return (
    status === "done" ||
    status === "ready" ||
    status === "failed" ||
    status === "error"
  );
}

/**
 * Client-side status poller for /ideas/[id]. Replaces the old
 * <meta httpEquiv="refresh">, which forced a full-page reload every 5s
 * (flicker + scroll loss). This soft-refreshes via router.refresh() only
 * when the server-side status changes, so the visible UI doesn't jump
 * while the analysis is running.
 */
export default function IdeaStatusPoll({
  id,
  initialStatus,
}: {
  id: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const lastStatusRef = useRef(initialStatus);

  useEffect(() => {
    if (isTerminal(initialStatus)) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/ideas?ids=${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          ideas?: Array<{ status?: string }>;
        };
        const newStatus = data.ideas?.[0]?.status;
        if (newStatus && newStatus !== lastStatusRef.current) {
          lastStatusRef.current = newStatus;
          router.refresh();
          if (isTerminal(newStatus)) {
            clearInterval(interval);
          }
        }
      } catch {
        // Network blip; keep polling.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, initialStatus, router]);

  return null;
}
