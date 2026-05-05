import { getTelegramConfig } from "@/lib/telegram/config";
import {
  setWebhook,
  deleteWebhook,
  getWebhookInfo,
} from "@/lib/telegram/client";
import { upsertTelegramChat } from "@/lib/telegram/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function adminAuthorised(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false; // fail-closed for admin actions
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

// GET /api/telegram/admin?op=info
// POST /api/telegram/admin   { op: "register-webhook" | "delete-webhook" | "register-chat", ... }
export async function GET(request: Request) {
  if (!adminAuthorised(request)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  try {
    const info = await getWebhookInfo();
    return Response.json({ ok: true, info });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!adminAuthorised(request)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Bad JSON." }, { status: 400 });
  }
  const op = body.op;

  try {
    if (op === "register-webhook") {
      const config = getTelegramConfig();
      const url = (body.url as string | undefined)
        ?? (config.publicAppUrl
              ? `${config.publicAppUrl}/api/telegram/webhook`
              : null);
      if (!url) {
        return Response.json(
          { ok: false, error: "No webhook URL — set TELEGRAM_PUBLIC_APP_URL or VERCEL_URL, or pass `url`." },
          { status: 400 },
        );
      }
      await setWebhook({
        url,
        secret_token: config.webhookSecret ?? undefined,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: body.drop_pending_updates === true,
      });
      const info = await getWebhookInfo();
      return Response.json({ ok: true, url, info });
    }

    if (op === "delete-webhook") {
      await deleteWebhook({ drop_pending_updates: body.drop_pending_updates === true });
      return Response.json({ ok: true });
    }

    if (op === "register-chat") {
      const required = ["telegram_user_id", "telegram_chat_id", "paperclip_user_id"] as const;
      for (const k of required) {
        if (typeof body[k] !== "string" && typeof body[k] !== "number") {
          return Response.json(
            { ok: false, error: `Missing field: ${k}` },
            { status: 400 },
          );
        }
      }
      await upsertTelegramChat({
        telegramUserId: BigInt(String(body.telegram_user_id)),
        telegramChatId: BigInt(String(body.telegram_chat_id)),
        paperclipUserId: String(body.paperclip_user_id),
        displayName:
          typeof body.display_name === "string" ? body.display_name : null,
      });
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: `Unknown op: ${op}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
