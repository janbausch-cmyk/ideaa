import { analyzeIdea } from "@/lib/analysis";
import { getIdea, isValidIdeaId } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STUCK_AGE_MS = 5 * 60 * 1000;

function isAuthorized(request: Request): {
  ok: true;
  mode: "token" | "bootstrap";
} | { ok: false; reason: string } {
  const expected = process.env.ADMIN_TOKEN;
  const header = request.headers.get("authorization");
  const presented = header?.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : null;

  if (expected) {
    if (presented && presented === expected) {
      return { ok: true, mode: "token" };
    }
    return { ok: false, reason: "Invalid or missing admin token." };
  }

  return { ok: true, mode: "bootstrap" };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isValidIdeaId(id)) {
    return Response.json({ ok: false, error: "Invalid idea id." }, { status: 400 });
  }
  const idea = await getIdea(id);
  if (!idea) {
    return Response.json({ ok: false, error: "Idea not found." }, { status: 404 });
  }
  return Response.json({
    ok: true,
    idea: {
      id: idea.id,
      status: idea.status,
      created_at: idea.created_at,
      analysis_started_at: idea.analysis_started_at,
      analysis_finished_at: idea.analysis_finished_at,
      analysis_error: idea.analysis_error,
      analysis_tool_trace: idea.analysis_tool_trace,
      report_chars: idea.analysis_report?.length ?? 0,
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isValidIdeaId(id)) {
    return Response.json({ ok: false, error: "Invalid idea id." }, { status: 400 });
  }

  const auth = isAuthorized(request);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.reason }, { status: 401 });
  }

  const before = await getIdea(id);
  if (!before) {
    return Response.json({ ok: false, error: "Idea not found." }, { status: 404 });
  }

  if (auth.mode === "bootstrap") {
    if (before.status !== "processing" || before.analysis_started_at) {
      return Response.json(
        {
          ok: false,
          error:
            "ADMIN_TOKEN not set; bootstrap mode only triggers stuck rows (status=processing, analysis_started_at IS NULL).",
          idea: {
            id: before.id,
            status: before.status,
            analysis_started_at: before.analysis_started_at,
          },
        },
        { status: 403 },
      );
    }
    const ageMs = Date.now() - new Date(before.created_at).getTime();
    if (ageMs < STUCK_AGE_MS) {
      return Response.json(
        {
          ok: false,
          error: `Bootstrap mode requires created_at older than ${STUCK_AGE_MS / 1000}s. Idea is ${Math.round(ageMs / 1000)}s old.`,
        },
        { status: 403 },
      );
    }
  }

  await analyzeIdea(id);

  const after = await getIdea(id);
  return Response.json({
    ok: true,
    auth_mode: auth.mode,
    idea: after && {
      id: after.id,
      status: after.status,
      analysis_started_at: after.analysis_started_at,
      analysis_finished_at: after.analysis_finished_at,
      analysis_error: after.analysis_error,
      report_preview: after.analysis_report?.slice(0, 240) ?? null,
    },
  });
}
