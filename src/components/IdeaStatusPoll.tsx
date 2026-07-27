"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 5000;

function isAnalysisTerminal(status: string | null | undefined): boolean {
  if (!status) return false;
  return (
    status === "done" ||
    status === "ready" ||
    status === "failed" ||
    status === "error"
  );
}

function isCopyToolkitTerminal(status: string | null | undefined): boolean {
  if (!status) return true; // legacy rows without the column are considered "done".
  return status === "done" || status === "failed";
}

/**
 * Client-side status poller for /ideas/[id]. Polls until BOTH the analysis
 * status and the copy-toolkit status are in a terminal state. Analysis
 * finishes first (~60–90s), copy-toolkit chains after (~10–20s), so the
 * page auto-refreshes twice: once when the report lands, once when the
 * toolkit lands.
 *
 * Soft-refresh via router.refresh() so the visible UI doesn't jump while
 * either pipeline is running.
 */
export default function IdeaStatusPoll({
  id,
  initialStatus,
  initialCopyToolkitStatus,
}: {
  id: string;
  initialStatus: string;
  initialCopyToolkitStatus?: string | null;
}) {
  const router = useRouter();
  const lastStatusRef = useRef(initialStatus);
  const lastCopyToolkitRef = useRef<string | null | undefined>(
    initialCopyToolkitStatus,
  );

  useEffect(() => {
    if (
      isAnalysisTerminal(initialStatus) &&
      isCopyToolkitTerminal(initialCopyToolkitStatus)
    ) {
      return;
    }

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
          ideas?: Array<{ status?: string; copy_toolkit_status?: string }>;
        };
        const entry = data.ideas?.[0];
        if (!entry) return;
        const newStatus = entry.status;
        const newCopy = entry.copy_toolkit_status;
        let changed = false;
        if (newStatus && newStatus !== lastStatusRef.current) {
          lastStatusRef.current = newStatus;
          changed = true;
        }
        if (newCopy !== lastCopyToolkitRef.current) {
          lastCopyToolkitRef.current = newCopy;
          changed = true;
        }
        if (changed) {
          router.refresh();
        }
        if (
          isAnalysisTerminal(lastStatusRef.current) &&
          isCopyToolkitTerminal(lastCopyToolkitRef.current)
        ) {
          clearInterval(interval);
        }
      } catch {
        // Network blip; keep polling.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, initialStatus, initialCopyToolkitStatus, router]);

  return null;
}
