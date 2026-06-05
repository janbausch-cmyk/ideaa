import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { ensureSchema, getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Bucket a failure message into a coarse category so the daily-LLM-error
// routine can tell "the provider is down" from "a single prompt blew up".
function categorize(error: string | null): string {
  if (!error) return "unknown";
  const s = error.toLowerCase();
  if (s.includes("anthropic_api_key") || s.includes("not set")) return "config";
  if (s.includes("rate") && s.includes("limit")) return "rate_limit";
  if (s.includes("overloaded") || s.includes("503") || s.includes("502")) return "provider_unavailable";
  if (s.includes("timeout") || s.includes("timed out")) return "timeout";
  if (s.includes("invalid_request_error") || s.includes("400")) return "bad_request";
  if (s.includes("authentication") || s.includes("401") || s.includes("invalid x-api-key")) return "auth";
  if (s.includes("max_tokens") || s.includes("context")) return "context_limit";
  return "other";
}

async function liveness(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (
    !process.env.DATABASE_URL &&
    !process.env.POSTGRES_URL &&
    !process.env.POSTGRES_URL_NON_POOLING
  ) {
    return { ok: false, error: "No Postgres connection string configured." };
  }
  try {
    await ensureSchema();
    const sql = getSql();
    await sql`SELECT 1`;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

type AggregateCounters = {
  ideas_total_24h: number;
  ideas_done_24h: number;
  analysis_failed_1h: number;
  analysis_failed_24h: number;
  queue_depth: number;
  running: number;
  stale_running: number;
};

async function aggregateCounters(): Promise<AggregateCounters> {
  const sql = getSql();
  const windowed = (await sql`
    SELECT
      count(*) FILTER (WHERE status = 'failed' AND created_at > now() - interval '1 hour')::int AS failed_1h,
      count(*) FILTER (WHERE status = 'failed' AND created_at > now() - interval '24 hours')::int AS failed_24h,
      count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS total_24h,
      count(*) FILTER (WHERE status = 'done' AND created_at > now() - interval '24 hours')::int AS done_24h
    FROM ideas
  `) as Array<{ failed_1h: number; failed_24h: number; total_24h: number; done_24h: number }>;
  const w = windowed[0] ?? { failed_1h: 0, failed_24h: 0, total_24h: 0, done_24h: 0 };
  const queue = (await sql`
    SELECT
      count(*) FILTER (WHERE status = 'queued')::int AS queued,
      count(*) FILTER (WHERE status = 'running')::int AS running,
      count(*) FILTER (
        WHERE status = 'running'
        AND analysis_started_at < now() - interval '10 minutes'
      )::int AS stale_running
    FROM ideas
  `) as Array<{ queued: number; running: number; stale_running: number }>;
  const q = queue[0] ?? { queued: 0, running: 0, stale_running: 0 };
  return {
    ideas_total_24h: w.total_24h,
    ideas_done_24h: w.done_24h,
    analysis_failed_1h: w.failed_1h,
    analysis_failed_24h: w.failed_24h,
    queue_depth: q.queued,
    running: q.running,
    stale_running: q.stale_running,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const detail = url.searchParams.get("detail") === "1";

  // Public path: liveness + aggregated counters. No UUIDs, no error strings,
  // no env flags. The 7 counters are safe to expose because they reveal only
  // coarse system health, not individual user submissions. The daily-LLM-error
  // routine (IDEAA-106) reads these to track zero-traffic days and failure
  // rates without needing an admin token.
  if (!detail) {
    const live = await liveness();
    if (!live.ok) return Response.json(live, { status: 503 });
    try {
      const counters = await aggregateCounters();
      return Response.json({ ok: true, ...counters });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ ok: false, error: message }, { status: 503 });
    }
  }

  // Detailed path: behind admin auth. Previously leaked failed-idea UUIDs
  // and 280-char error excerpts; those stay admin-gated.
  if (!(await isAdminRequestAuthorized(request))) {
    return Response.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  const live = await liveness();
  if (!live.ok) return Response.json(live, { status: 503 });

  const sql = getSql();
  try {
    const rows = (await sql`SELECT count(*)::int AS n FROM ideas`) as Array<{
      n: number;
    }>;
    const counters = await aggregateCounters();
    const recentFailures = (await sql`
      SELECT id::text AS id, created_at, analysis_finished_at, analysis_error
      FROM ideas
      WHERE status = 'failed' AND created_at > now() - interval '24 hours'
      ORDER BY created_at DESC
      LIMIT 25
    `) as Array<{
      id: string;
      created_at: string;
      analysis_finished_at: string | null;
      analysis_error: string | null;
    }>;
    const buckets: Record<string, number> = {};
    for (const row of recentFailures) {
      const cat = categorize(row.analysis_error);
      buckets[cat] = (buckets[cat] ?? 0) + 1;
    }
    return Response.json({
      ok: true,
      env: {
        has_database_url: Boolean(process.env.DATABASE_URL),
        has_postgres_url: Boolean(process.env.POSTGRES_URL),
        has_postgres_url_non_pooling: Boolean(process.env.POSTGRES_URL_NON_POOLING),
        has_anthropic_api_key: Boolean(process.env.ANTHROPIC_API_KEY),
        has_stripe_webhook_secret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        vercel_env: process.env.VERCEL_ENV ?? null,
      },
      ideas_count: rows[0]?.n ?? 0,
      ...counters,
      failure_categories_24h: buckets,
      recent_failures: recentFailures.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        finished_at: r.analysis_finished_at,
        error: (r.analysis_error ?? "").slice(0, 280),
        category: categorize(r.analysis_error),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 503 });
  }
}
