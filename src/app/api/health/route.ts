import { ensureSchema, getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

type EnvCheck = {
  has_database_url: boolean;
  has_postgres_url: boolean;
  has_postgres_url_non_pooling: boolean;
};

function envCheck(): EnvCheck {
  return {
    has_database_url: Boolean(process.env.DATABASE_URL),
    has_postgres_url: Boolean(process.env.POSTGRES_URL),
    has_postgres_url_non_pooling: Boolean(process.env.POSTGRES_URL_NON_POOLING),
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
    return Response.json({
      ok: true,
      env,
      ideas_count: rows[0]?.n ?? 0,
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
