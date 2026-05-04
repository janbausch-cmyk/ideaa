import { after } from "next/server";

import { getIdeaStatuses } from "@/lib/db";
import { runWorkerTick } from "@/lib/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  // still queued. This makes the index page self-healing — even if the
  // submit-time after() handler died, polling will revive the queue.
  const hasQueued = rows.some((r) => r.status === "queued");
  if (hasQueued) {
    after(async () => {
      try {
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
