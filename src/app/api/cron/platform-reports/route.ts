import {
  generateAndPersistWeeklyPlatformReport,
  weekStartAtFor,
} from "@/lib/platform-report";

export const dynamic = "force-dynamic";
// Web-search-heavy weekly report runs for ~30–60s. Match the admin route ceiling.
export const maxDuration = 300;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function isAuthorizedCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length === 0) return false;
  const header = request.headers.get("authorization");
  if (!header) return false;
  const presented = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : null;
  if (!presented) return false;
  return timingSafeEqual(presented, expected);
}

async function runWeeklyReport(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const target = weekStartAtFor();
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
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        model: row.model,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron platform-report] generation failed", message);
    return Response.json(
      { ok: false, error: message, elapsed_ms: Date.now() - startedAt },
      { status: 500 },
    );
  }
}

// Vercel Cron sends a GET with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  return runWeeklyReport(request);
}

// POST kept for manual smoke tests via curl.
export async function POST(request: Request) {
  return runWeeklyReport(request);
}
