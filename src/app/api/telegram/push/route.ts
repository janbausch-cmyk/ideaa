import { runPush } from "@/lib/telegram/push";
import { getTelegramConfig } from "@/lib/telegram/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorise(request: Request, expected: string | null): boolean {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>. If no secret is
  // configured, fall back to allowing the Vercel cron header.
  if (!expected) return request.headers.get("x-vercel-cron") !== null;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

async function run(request: Request) {
  let config: ReturnType<typeof getTelegramConfig>;
  try {
    config = getTelegramConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 503 });
  }

  if (!authorise(request, config.cronSecret)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  try {
    const report = await runPush();
    return Response.json({ ok: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
