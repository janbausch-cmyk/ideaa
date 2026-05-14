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
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS admin_note text`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS deepdive_status text NOT NULL DEFAULT 'idle'`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS deepdive_report text`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS deepdive_started_at timestamptz`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS deepdive_finished_at timestamptz`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS deepdive_error text`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS deepdive_tool_trace jsonb`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS deepdive_input_tokens int`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS deepdive_output_tokens int`;
      await sql`ALTER TABLE ideas ADD COLUMN IF NOT EXISTS deepdive_model text`;
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

      await sql`
        CREATE TABLE IF NOT EXISTS weekly_platform_reports (
          id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          week_start_at timestamptz NOT NULL,
          body          text NOT NULL,
          tool_trace    jsonb,
          input_tokens  int,
          output_tokens int,
          model         text,
          created_at    timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS weekly_platform_reports_week_start_at_idx ON weekly_platform_reports (week_start_at DESC)`;
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

export type DeepdiveStatus = "idle" | "queued" | "running" | "done" | "failed";

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
  admin_note: string | null;
  tags: string[];
  deepdive_status: string;
  deepdive_report: string | null;
  deepdive_started_at: string | null;
  deepdive_finished_at: string | null;
  deepdive_error: string | null;
  deepdive_tool_trace: ToolTraceEntry[] | null;
  deepdive_input_tokens: number | null;
  deepdive_output_tokens: number | null;
  deepdive_model: string | null;
};

const IDEA_COLUMNS = `
  id, raw_text, status, created_at, updated_at,
  analysis_report, analysis_error, analysis_started_at, analysis_finished_at,
  analysis_tool_trace, admin_note, tags,
  deepdive_status, deepdive_report, deepdive_started_at, deepdive_finished_at,
  deepdive_error, deepdive_tool_trace,
  deepdive_input_tokens, deepdive_output_tokens, deepdive_model
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

// --- Admin queries -------------------------------------------------------

export type AdminIdeaListRow = {
  id: string;
  raw_text_preview: string;
  status: string;
  created_at: string;
  updated_at: string;
  analysis_started_at: string | null;
  analysis_finished_at: string | null;
  analysis_error: string | null;
  admin_note: string | null;
  tags: string[];
};

export type AdminListFilter = {
  status?: string;
  q?: string;
  sort?: "created_desc" | "created_asc" | "updated_desc" | "status";
  limit?: number;
  offset?: number;
};

export type AdminListResult = {
  rows: AdminIdeaListRow[];
  total: number;
};

const ADMIN_LIST_PREVIEW = 200;
const ADMIN_LIST_DEFAULT_LIMIT = 50;
const ADMIN_LIST_MAX_LIMIT = 200;
const VALID_STATUSES: ReadonlySet<string> = new Set([
  "queued",
  "running",
  "done",
  "failed",
]);

export async function adminListIdeas(
  filter: AdminListFilter = {},
): Promise<AdminListResult> {
  await ensureSchema();
  const sql = getSql();
  const status =
    filter.status && VALID_STATUSES.has(filter.status) ? filter.status : null;
  const q = filter.q?.trim() ? `%${filter.q.trim()}%` : null;
  const limit = Math.min(
    Math.max(filter.limit ?? ADMIN_LIST_DEFAULT_LIMIT, 1),
    ADMIN_LIST_MAX_LIMIT,
  );
  const offset = Math.max(filter.offset ?? 0, 0);
  const sortKey = filter.sort ?? "created_desc";
  const orderBy =
    sortKey === "created_asc"
      ? sql.unsafe("created_at ASC")
      : sortKey === "updated_desc"
        ? sql.unsafe("updated_at DESC")
        : sortKey === "status"
          ? sql.unsafe("status ASC, created_at DESC")
          : sql.unsafe("created_at DESC");

  const rows = (await sql`
    SELECT
      id::text AS id,
      substring(raw_text from 1 for ${ADMIN_LIST_PREVIEW}) AS raw_text_preview,
      status,
      created_at,
      updated_at,
      analysis_started_at,
      analysis_finished_at,
      analysis_error,
      admin_note,
      tags
    FROM ideas
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (
        ${q}::text IS NULL
        OR raw_text ILIKE ${q}
        OR analysis_report ILIKE ${q}
        OR admin_note ILIKE ${q}
      )
    ORDER BY ${orderBy}
    LIMIT ${limit}
    OFFSET ${offset}
  `) as AdminIdeaListRow[];

  const totals = (await sql`
    SELECT count(*)::int AS n
    FROM ideas
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (
        ${q}::text IS NULL
        OR raw_text ILIKE ${q}
        OR analysis_report ILIKE ${q}
        OR admin_note ILIKE ${q}
      )
  `) as Array<{ n: number }>;
  return { rows, total: totals[0]?.n ?? 0 };
}

export async function adminAllIdeasForExport(): Promise<IdeaRow[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT ${sql.unsafe(IDEA_COLUMNS)}
    FROM ideas
    ORDER BY created_at DESC
  `) as IdeaRow[];
  return rows;
}

export async function adminUpdateIdea(
  id: string,
  patch: { status?: string; admin_note?: string | null; tags?: string[] },
): Promise<IdeaRow | null> {
  if (!isValidIdeaId(id)) return null;
  await ensureSchema();
  const sql = getSql();
  const status =
    patch.status && VALID_STATUSES.has(patch.status) ? patch.status : null;
  const note = patch.admin_note ?? null;
  const setNote = patch.admin_note !== undefined;
  const tags = patch.tags ?? null;
  const setTags = patch.tags !== undefined;
  const rows = (await sql`
    UPDATE ideas
    SET
      status = COALESCE(${status}::text, status),
      admin_note = CASE WHEN ${setNote}::boolean THEN ${note}::text ELSE admin_note END,
      tags = CASE WHEN ${setTags}::boolean THEN ${tags}::text[] ELSE tags END,
      updated_at = now()
    WHERE id = ${id}::uuid
    RETURNING ${sql.unsafe(IDEA_COLUMNS)}
  `) as IdeaRow[];
  return rows[0] ?? null;
}

// --- Deepdive (Ausarbeitung) ---------------------------------------------

// Matches the page-level maxDuration (300s) in app/admin/ideas/[id]/page.tsx
// plus a small buffer. If a row has been "running" longer than this, the
// Vercel function that owned it is definitely dead and the row is reclaimable.
const DEEPDIVE_STALE_AFTER_SECONDS = 360;

/**
 * Atomically transitions a deepdive into 'running' state. Returns the row
 * iff it was claimed. A row is claimable when status is idle/done/failed
 * (fresh kick-off or re-run), or when it's been stuck in queued/running for
 * longer than the stale window (worker process died mid-flight).
 */
export async function claimDeepdive(id: string): Promise<IdeaRow | null> {
  if (!isValidIdeaId(id)) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    UPDATE ideas
    SET deepdive_status = 'running',
        deepdive_started_at = now(),
        deepdive_finished_at = NULL,
        deepdive_error = NULL,
        updated_at = now()
    WHERE id = ${id}::uuid
      AND (
        deepdive_status IN ('idle', 'done', 'failed')
        OR (
          deepdive_status IN ('queued', 'running')
          AND deepdive_started_at IS NOT NULL
          AND deepdive_started_at < now() - (${DEEPDIVE_STALE_AFTER_SECONDS} || ' seconds')::interval
        )
      )
    RETURNING ${sql.unsafe(IDEA_COLUMNS)}
  `) as IdeaRow[];
  return rows[0] ?? null;
}

export async function saveDeepdiveReady(
  id: string,
  report: string,
  toolTrace: ToolTraceEntry[] | null,
  usage: { input_tokens: number | null; output_tokens: number | null; model: string | null },
): Promise<void> {
  if (!isValidIdeaId(id)) return;
  await ensureSchema();
  const sql = getSql();
  const traceJson = toolTrace ? JSON.stringify(toolTrace) : null;
  await sql`
    UPDATE ideas
    SET deepdive_status = 'done',
        deepdive_report = ${report},
        deepdive_error = NULL,
        deepdive_tool_trace = ${traceJson}::jsonb,
        deepdive_finished_at = now(),
        deepdive_input_tokens = ${usage.input_tokens},
        deepdive_output_tokens = ${usage.output_tokens},
        deepdive_model = ${usage.model},
        updated_at = now()
    WHERE id = ${id}::uuid
  `;
}

export async function saveDeepdiveFailed(
  id: string,
  errorMessage: string,
): Promise<void> {
  if (!isValidIdeaId(id)) return;
  await ensureSchema();
  const sql = getSql();
  await sql`
    UPDATE ideas
    SET deepdive_status = 'failed',
        deepdive_error = ${errorMessage},
        deepdive_finished_at = now(),
        updated_at = now()
    WHERE id = ${id}::uuid
  `;
}

// --- Weekly platform-positioning reports ---------------------------------

export type WeeklyPlatformReportRow = {
  id: string;
  week_start_at: string;
  body: string;
  tool_trace: ToolTraceEntry[] | null;
  input_tokens: number | null;
  output_tokens: number | null;
  model: string | null;
  created_at: string;
};

const WEEKLY_REPORT_COLUMNS = `
  id::text AS id, week_start_at, body, tool_trace,
  input_tokens, output_tokens, model, created_at
`;

export async function insertWeeklyPlatformReport(args: {
  weekStartAt: Date;
  body: string;
  toolTrace: ToolTraceEntry[] | null;
  inputTokens: number | null;
  outputTokens: number | null;
  model: string | null;
}): Promise<WeeklyPlatformReportRow> {
  await ensureSchema();
  const sql = getSql();
  const traceJson = args.toolTrace ? JSON.stringify(args.toolTrace) : null;
  const rows = (await sql`
    INSERT INTO weekly_platform_reports
      (week_start_at, body, tool_trace, input_tokens, output_tokens, model)
    VALUES (
      ${args.weekStartAt.toISOString()},
      ${args.body},
      ${traceJson}::jsonb,
      ${args.inputTokens},
      ${args.outputTokens},
      ${args.model}
    )
    RETURNING ${sql.unsafe(WEEKLY_REPORT_COLUMNS)}
  `) as WeeklyPlatformReportRow[];
  return rows[0];
}

export async function listRecentWeeklyPlatformReports(
  limit = 4,
): Promise<WeeklyPlatformReportRow[]> {
  await ensureSchema();
  const sql = getSql();
  const safeLimit = Math.min(Math.max(limit, 1), 52);
  const rows = (await sql`
    SELECT ${sql.unsafe(WEEKLY_REPORT_COLUMNS)}
    FROM weekly_platform_reports
    ORDER BY week_start_at DESC, created_at DESC
    LIMIT ${safeLimit}
  `) as WeeklyPlatformReportRow[];
  return rows;
}

export async function getWeeklyPlatformReport(
  id: string,
): Promise<WeeklyPlatformReportRow | null> {
  if (!UUID_RE.test(id)) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT ${sql.unsafe(WEEKLY_REPORT_COLUMNS)}
    FROM weekly_platform_reports
    WHERE id = ${id}::uuid
    LIMIT 1
  `) as WeeklyPlatformReportRow[];
  return rows[0] ?? null;
}

export async function adminDeleteIdea(id: string): Promise<boolean> {
  if (!isValidIdeaId(id)) return false;
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM ideas WHERE id = ${id}::uuid RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}
