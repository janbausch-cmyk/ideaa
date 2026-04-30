import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cachedSql: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

function resolveConnectionString(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING;
  if (!url) {
    throw new Error(
      "No Postgres connection string. Set DATABASE_URL or POSTGRES_URL.",
    );
  }
  return url;
}

export function getSql(): NeonQueryFunction<false, false> {
  if (!cachedSql) {
    cachedSql = neon(resolveConnectionString());
  }
  return cachedSql;
}

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS ideas (
          id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          raw_text    text NOT NULL,
          status      text NOT NULL DEFAULT 'processing',
          created_at  timestamptz NOT NULL DEFAULT now(),
          updated_at  timestamptz NOT NULL DEFAULT now()
        )
      `;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export type IdeaRow = {
  id: string;
  raw_text: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function insertIdea(rawText: string): Promise<IdeaRow> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO ideas (raw_text)
    VALUES (${rawText})
    RETURNING id, raw_text, status, created_at, updated_at
  `) as IdeaRow[];
  return rows[0];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidIdeaId(id: string): boolean {
  return UUID_RE.test(id);
}

export async function getIdea(id: string): Promise<IdeaRow | null> {
  if (!isValidIdeaId(id)) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, raw_text, status, created_at, updated_at
    FROM ideas
    WHERE id = ${id}::uuid
    LIMIT 1
  `) as IdeaRow[];
  return rows[0] ?? null;
}
