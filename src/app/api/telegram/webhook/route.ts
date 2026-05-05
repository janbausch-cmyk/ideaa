import { handleUpdate, type TelegramUpdate } from "@/lib/telegram/pull";
import { getTelegramConfig } from "@/lib/telegram/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function unauthorised(message: string) {
  return Response.json({ ok: false, error: message }, { status: 401 });
}

export async function POST(request: Request) {
  let config: ReturnType<typeof getTelegramConfig>;
  try {
    config = getTelegramConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 503 });
  }

  if (config.webhookSecret) {
    const presented = request.headers.get("x-telegram-bot-api-secret-token");
    if (presented !== config.webhookSecret) {
      return unauthorised("Bad secret token.");
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return Response.json({ ok: false, error: "Bad JSON." }, { status: 400 });
  }

  try {
    const result = await handleUpdate(update);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Always 200 so Telegram doesn't retry-storm; surface error in body.
    return Response.json({ ok: false, error: message });
  }
}
