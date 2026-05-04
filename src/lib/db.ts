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
          status      text NOT NULL DEFAULT 'queued',
          created_at  timestamptz NOT NULL DEFAULT now(),
          updated_at  timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS analysis_report text`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS analysis_error text`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS analysis_started_at timestamptz`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS analysis_finished_at timestamptz`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS analysis_tool_trace jsonb`;
      // Migrate legacy status names to the new vocabulary. Idempotent.
      await sql`UPDATE ideas SET status = 'done' WHERE status = 'ready'`;
      await sql`
        UPDATE ideas
        SET status = 'running'
        WHERE status = 'processing' AND analysis_started_at IS NOT NULL
      `;
      await sql`
        UPDATE ideas
        SET status = 'queued'
        WHERE status = 'processing' AND analysis_started_at IS NULL
      `;
      await sql`CREATE INDEX IF NOT EXISTS ideas_status_created_at_idx ON ideas (status, created_at)`;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export type IdeaStatus = "queued" | "running" | "done" | "failed";

export type ToolTraceEntry =
  | {
      kind: "search_request";
      tool_use_id: string;
      input: { query?: string } & Record<string, unknown>;
    }
  | {
      kind: "search_result";
      tool_use_id: string;
      result_count: number;
      urls: string[];
      error?: string;
    };

export type IdeaRow = {
  id: string;
  raw_text: string;
  status: string;
  created_at: string;
  updated_at: string;
  analysis_report: string | null;
  analysis_error: string | null;
  analysis_started_at: string | null;
  analysis_finished_at: string | null;
  analysis_tool_trace: ToolTraceEntry[] | null;
};

const IDEA_COLUMNS = `
  id, raw_text, status, created_at, updated_at,
  analysis_report, analysis_error, analysis_started_at, analysis_finished_at,
  analysis_tool_trace
`;

export async function insertIdea(rawText: string): Promise<IdeaRow> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO ideas (raw_text, status)
    VALUES (${rawText}, 'queued')
    RETURNING ${sql.unsafe(IDEA_COLUMNS)}
  `) as IdeaRow[];
  return rows[0];
}

export async function insertIdeas(rawTexts: string[]): Promise<IdeaRow[]> {
  if (rawTexts.length === 0) return [];
  if (rawTexts.length === 1) return [await insertIdea(rawTexts[0])];
  await ensureSchema();
  // Neon serverless tagged-template doesn't accept array unnest cleanly, so
  // run inserts in parallel — each is a single autocommit statement.
  return Promise.all(rawTexts.map((t) => insertIdea(t)));
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
    SELECT ${sql.unsafe(IDEA_COLUMNS)}
    FROM ideas
    WHERE id = ${id}::uuid
    LIMIT 1
  `) as IdeaRow[];
  return rows[0] ?? null;
}

export type IdeaStatusRow = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  analysis_started_at: string | null;
  analysis_finished_at: string | null;
  raw_text_preview: string;
};

const PREVIEW_CHARS = 80;

export async function getIdeaStatuses(
  ids: string[],
): Promise<IdeaStatusRow[]> {
  const valid = ids.filter(isValidIdeaId);
  if (valid.length === 0) return [];
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id::text AS id, status, created_at, updated_at,
           analysis_started_at, analysis_finished_at,
           substring(raw_text from 1 for ${PREVIEW_CHARS}) AS raw_text_preview
    FROM ideas
    WHERE id = ANY(${valid}::uuid[])
  `) as IdeaStatusRow[];
  return rows;
}

/**
 * Atomically claim the next queued idea using SKIP LOCKED so concurrent
 * worker loops don't race on the same row. Returns null when the queue is
 * empty.
 */
export async function claimNextQueuedIdea(): Promise<IdeaRow | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    UPDATE ideas
    SET status = 'running',
        analysis_started_at = COALESCE(analysis_started_at, now()),
        updated_at = now()
    WHERE id = (
      SELECT id FROM ideas
      WHERE status = 'queued'
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING ${sql.unsafe(IDEA_COLUMNS)}
  `) as IdeaRow[];
  return rows[0] ?? null;
}

/**
 * Recover ideas that have been stuck in 'running' for too long (e.g. their
 * worker process was killed mid-flight). Idempotent and cheap.
 */
export async function requeueStaleRunning(staleAfterSeconds = 600): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    UPDATE ideas
    SET status = 'queued',
        analysis_started_at = NULL,
        updated_at = now()
    WHERE status = 'running'
      AND analysis_started_at IS NOT NULL
      AND analysis_started_at < now() - (${staleAfterSeconds} || ' seconds')::interval
    RETURNING id
  `) as Array<{ id: string }>;
  return rows.length;
}

export async function countQueued(): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT count(*)::int AS n FROM ideas WHERE status = 'queued'
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

export async function saveAnalysisReady(
  id: string,
  report: string,
  toolTrace: ToolTraceEntry[] | null,
): Promise<void> {
  if (!isValidIdeaId(id)) return;
  await ensureSchema();
  const sql = getSql();
  const traceJson = toolTrace ? JSON.stringify(toolTrace) : null;
  await sql`
    UPDATE ideas
    SET status = 'done',
        analysis_report = ${report},
        analysis_error = NULL,
        analysis_tool_trace = ${traceJson}::jsonb,
        analysis_finished_at = now(),
        updated_at = now()
    WHERE id = ${id}::uuid
  `;
}

export async function saveAnalysisFailed(
  id: string,
  errorMessage: string,
): Promise<void> {
  if (!isValidIdeaId(id)) return;
  await ensureSchema();
  const sql = getSql();
  await sql`
    UPDATE ideas
    SET status = 'failed',
        analysis_error = ${errorMessage},
        analysis_finished_at = now(),
        updated_at = now()
    WHERE id = ${id}::uuid
  `;
}
