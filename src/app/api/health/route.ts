import { ensureSchema, getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

type EnvCheck = {
  has_database_url: boolean;
  has_postgres_url: boolean;
  has_postgres_url_non_pooling: boolean;
  has_anthropic_api_key: boolean;
  vercel_env: string | null;
};

function envCheck(): EnvCheck {
  return {
    has_database_url: Boolean(process.env.DATABASE_URL),
    has_postgres_url: Boolean(process.env.POSTGRES_URL),
    has_postgres_url_non_pooling: Boolean(process.env.POSTGRES_URL_NON_POOLING),
    has_anthropic_api_key: Boolean(process.env.ANTHROPIC_API_KEY),
    vercel_env: process.env.VERCEL_ENV ?? null,
  };
}

export async function GET() {
  const env = envCheck();
  const anyConnString =
    env.has_database_url ||
    env.has_postgres_url ||
    env.has_postgres_url_non_pooling;
  if (!anyConnString) {
    return Response.json(
      {
        ok: false,
        env,
        error:
          "No Postgres connection string. Set DATABASE_URL or add the Vercel Neon integration.",
      },
      { status: 503 },
    );
  }

  try {
    await ensureSchema();
    const sql = getSql();
    const rows = (await sql`SELECT count(*)::int AS n FROM ideas`) as Array<{
      n: number;
    }>;
    const failed24h = (await sql`
      SELECT count(*)::int AS n
      FROM ideas
      WHERE status = 'failed' AND created_at > now() - interval '24 hours'
    `) as Array<{ n: number }>;
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
    return Response.json({
      ok: true,
      env,
      ideas_count: rows[0]?.n ?? 0,
      analysis_failed_24h: failed24h[0]?.n ?? 0,
      queue_depth: q.queued,
      running: q.running,
      stale_running: q.stale_running,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        ok: false,
        env,
        error: message,
      },
      { status: 503 },
    );
  }
}
