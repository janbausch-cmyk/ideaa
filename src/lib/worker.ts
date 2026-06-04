import "server-only";

import { analyzeClaimedIdea } from "./analysis";
import {
  claimNextQueuedIdea,
  getIdea,
  getSql,
  isValidIdeaId,
  requeueStaleRunning,
  type IdeaRow,
} from "./db";

function getConcurrency(): number {
  const raw = process.env.WORKER_CONCURRENCY;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 10) return parsed;
  return 3;
}

// Must stay above P99 analysis duration (worst case: 20 web_search results +
// 20 link-checks at 4s timeout each). 320s gives a small buffer over the
// Vercel function lifetime (300s).
export const STALE_RUNNING_RECOVERY_SECONDS = 320;

let activeTick: Promise<void> | null = null;

async function workerLoop(): Promise<void> {
  // Each loop drains the queue greedily until it finds nothing to claim.
  // Multiple loops run in parallel; the SKIP LOCKED claim guarantees they
  // never pick the same row.
  while (true) {
    let claimed: IdeaRow | null = null;
    try {
      claimed = await claimNextQueuedIdea();
    } catch (err) {
      console.error("[worker] claim failed", err);
      return;
    }
    if (!claimed) return;
    try {
      await analyzeClaimedIdea(claimed);
    } catch (err) {
      // analyzeClaimedIdea handles its own errors; this catch is defensive.
      console.error("[worker] analyze threw outside try/catch", err);
    }
  }
}

/**
 * Run a queue-draining tick. Spawns N worker loops in parallel, each of which
 * pulls queued ideas via SKIP LOCKED until none remain.
 *
 * Multiple ticks may run concurrently (e.g. two batch submits arriving at the
 * same time). They cooperate via the database, so concurrent ticks are safe;
 * we just dedupe within a single process to avoid spawning excessive loops.
 */
export async function runWorkerTick(): Promise<void> {
  if (activeTick) return activeTick;
  const concurrency = getConcurrency();
  activeTick = (async () => {
    try {
      // Recovery pass: a row stuck in 'running' for longer than the Vercel
      // function lifetime (300s) is definitely dead. Threshold must stay
      // above P99 of healthy analysis duration (web_search + link-checks can
      // legitimately push 200s+); too tight reclaims live runs and causes
      // double Anthropic calls + write-races on the result.
      try {
        await requeueStaleRunning(STALE_RUNNING_RECOVERY_SECONDS);
      } catch (err) {
        console.error("[worker] stale-recovery failed", err);
      }
      await Promise.all(
        Array.from({ length: concurrency }, () => workerLoop()),
      );
    } finally {
      activeTick = null;
    }
  })();
  return activeTick;
}

/**
 * One-shot processor for a specific id, used by the admin backfill route.
 * Atomically claims the row (only if it's queued or has been 'running' for
 * long enough to be considered abandoned), then runs the analysis.
 */
export async function processIdeaById(
  id: string,
  staleAfterSeconds = 300,
): Promise<{ claimed: boolean; status: string | null }> {
  if (!isValidIdeaId(id)) return { claimed: false, status: null };
  const sql = getSql();
  const rows = (await sql`
    UPDATE ideas
    SET status = 'running',
        analysis_started_at = now(),
        updated_at = now()
    WHERE id = ${id}::uuid
      AND (
        status = 'queued'
        OR (
          status = 'running'
          AND analysis_started_at IS NOT NULL
          AND analysis_started_at < now() - (${staleAfterSeconds} || ' seconds')::interval
        )
      )
    RETURNING id::text AS id, raw_text, status, created_at, updated_at,
              analysis_report, analysis_error, analysis_started_at,
              analysis_finished_at, analysis_tool_trace
  `) as IdeaRow[];
  const claimed = rows[0];
  if (!claimed) {
    const current = await getIdea(id);
    return { claimed: false, status: current?.status ?? null };
  }
  await analyzeClaimedIdea(claimed);
  const after = await getIdea(id);
  return { claimed: true, status: after?.status ?? null };
}
