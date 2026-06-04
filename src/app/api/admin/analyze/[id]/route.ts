import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { getIdea, isValidIdeaId } from "@/lib/db";
import { processIdeaById } from "@/lib/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STUCK_AGE_MS = 5 * 60 * 1000;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminRequestAuthorized(request))) {
    return Response.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }
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
  // Admin auth is required. The previous "bootstrap" fallback (no token =
  // open for stuck rows) was a footgun: a misconfigured deploy without
  // ADMIN_TOKEN would silently expose this endpoint to the internet.
  if (!(await isAdminRequestAuthorized(request))) {
    return Response.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  if (!isValidIdeaId(id)) {
    return Response.json({ ok: false, error: "Invalid idea id." }, { status: 400 });
  }

  const before = await getIdea(id);
  if (!before) {
    return Response.json({ ok: false, error: "Idea not found." }, { status: 404 });
  }

  const result = await processIdeaById(id, STUCK_AGE_MS / 1000);

  const after = await getIdea(id);
  return Response.json({
    ok: true,
    claimed: result.claimed,
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
