import { after } from "next/server";

import { getIdeaStatuses, requeueStaleRunning } from "@/lib/db";
import { runWorkerTick } from "@/lib/worker";

export const dynamic = "force-dynamic";
// Worker analyses take ~60–90s each. With 3 concurrent loops, draining a 5-idea
// batch needs ~180s; bump the route lifetime so the polling-driven recovery tick
// doesn't get killed mid-analysis (which would strand the row in 'running').
export const maxDuration = 300;

// If a row has been sitting in 'running' for longer than this, the worker
// process that claimed it is presumed dead — re-queue so a fresh tick picks
// it up. Short enough to recover from a serverless function kill quickly,
// long enough to not interrupt a healthy in-flight analysis.
const STALE_RUNNING_RECOVERY_SECONDS = 150;

const MAX_IDS_PER_QUERY = 50;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_IDS_PER_QUERY);

  if (ids.length === 0) {
    return Response.json({ ideas: [] });
  }

  const rows = await getIdeaStatuses(ids);

  // Opportunistically kick the worker if any of the requested ideas are
  // queued OR have been stuck in 'running' long enough to be considered
  // dead. This makes the index page self-healing — even if a prior worker
  // tick was killed by the serverless platform mid-analysis, polling
  // re-queues the row and revives the queue.
  const now = Date.now();
  const hasQueued = rows.some((r) => r.status === "queued");
  const hasStaleRunning = rows.some(
    (r) =>
      r.status === "running" &&
      !!r.analysis_started_at &&
      now - new Date(r.analysis_started_at).getTime() >
        STALE_RUNNING_RECOVERY_SECONDS * 1000,
  );
  if (hasQueued || hasStaleRunning) {
    after(async () => {
      try {
        if (hasStaleRunning) {
          await requeueStaleRunning(STALE_RUNNING_RECOVERY_SECONDS);
        }
        await runWorkerTick();
      } catch (err) {
        console.error("[/api/ideas] worker tick failed", err);
      }
    });
  }

  return Response.json({
    ideas: rows.map((r) => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      analysis_started_at: r.analysis_started_at,
      analysis_finished_at: r.analysis_finished_at,
      raw_text_preview: r.raw_text_preview,
    })),
  });
}
