"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 4000;

/**
 * Auto-refreshes the admin idea-detail page while a deepdive is queued or
 * running. Server-rendered status determines whether polling is active; the
 * client just calls router.refresh() on an interval, which re-renders the
 * server component with fresh deepdive_status from the DB.
 */
export default function DeepdiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const tick = () => router.refresh();
    const handle = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [active, router]);
  return null;
}
