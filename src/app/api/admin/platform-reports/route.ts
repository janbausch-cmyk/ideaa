import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import {
  generateAndPersistWeeklyPlatformReport,
  weekStartAtFor,
} from "@/lib/platform-report";
import { listRecentWeeklyPlatformReports } from "@/lib/db";

export const dynamic = "force-dynamic";
// Web-search-heavy weekly report runs for ~30–60s. Give Vercel the room.
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const rows = await listRecentWeeklyPlatformReports(12);
  return Response.json({
    ok: true,
    reports: rows.map((r) => ({
      id: r.id,
      week_start_at: r.week_start_at,
      created_at: r.created_at,
      body_chars: r.body.length,
      model: r.model,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
    })),
  });
}

export async function POST(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let weekStartAt: Date | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      week_start_at?: string;
    };
    if (typeof body.week_start_at === "string" && body.week_start_at) {
      const parsed = new Date(body.week_start_at);
      if (!Number.isNaN(parsed.getTime())) {
        weekStartAt = weekStartAtFor(parsed);
      }
    }
  } catch {
    // ignore — fall through to default
  }
  const target = weekStartAt ?? weekStartAtFor();

  const startedAt = Date.now();
  try {
    const row = await generateAndPersistWeeklyPlatformReport(target);
    return Response.json({
      ok: true,
      elapsed_ms: Date.now() - startedAt,
      report: {
        id: row.id,
        week_start_at: row.week_start_at,
        created_at: row.created_at,
        body_chars: row.body.length,
        body_preview: row.body.slice(0, 320),
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        model: row.model,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[platform-report] generation failed", message);
    return Response.json(
      { ok: false, error: message, elapsed_ms: Date.now() - startedAt },
      { status: 500 },
    );
  }
}
