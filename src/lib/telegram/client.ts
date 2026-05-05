// Thin Telegram Bot API wrapper. We only use the small slice we actually need.
// Docs: https://core.telegram.org/bots/api

const TG_API = "https://api.telegram.org";

export class TelegramApiError extends Error {
  constructor(
    public readonly method: string,
    public readonly status: number,
    public readonly description: string,
  ) {
    super(`Telegram ${method} failed (${status}): ${description}`);
  }
}

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return t;
}

async function call<T>(method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${TG_API}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json()) as
    | { ok: true; result: T }
    | { ok: false; description: string; error_code: number };
  if (!json.ok) {
    throw new TelegramApiError(method, json.error_code, json.description);
  }
  return json.result;
}

export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

export type SendMessageOptions = {
  chat_id: number | string;
  text: string;
  parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
  disable_web_page_preview?: boolean;
  reply_markup?: { inline_keyboard: InlineKeyboardButton[][] };
  reply_to_message_id?: number;
};

export type TelegramMessage = {
  message_id: number;
  chat: { id: number };
  date: number;
};

export function sendMessage(opts: SendMessageOptions): Promise<TelegramMessage> {
  return call<TelegramMessage>("sendMessage", opts);
}

export function editMessageText(opts: {
  chat_id: number | string;
  message_id: number;
  text: string;
  parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
  reply_markup?: { inline_keyboard: InlineKeyboardButton[][] };
}): Promise<TelegramMessage | true> {
  return call<TelegramMessage | true>("editMessageText", opts);
}

export function editMessageReplyMarkup(opts: {
  chat_id: number | string;
  message_id: number;
  reply_markup?: { inline_keyboard: InlineKeyboardButton[][] };
}): Promise<TelegramMessage | true> {
  return call<TelegramMessage | true>("editMessageReplyMarkup", opts);
}

export function answerCallbackQuery(opts: {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
}): Promise<true> {
  return call<true>("answerCallbackQuery", opts);
}

export function getFile(file_id: string): Promise<{
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}> {
  return call("getFile", { file_id });
}

export async function downloadFile(file_path: string): Promise<ArrayBuffer> {
  const url = `${TG_API}/file/bot${token()}/${file_path}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new TelegramApiError("downloadFile", res.status, await res.text());
  }
  return res.arrayBuffer();
}

export function setWebhook(opts: {
  url: string;
  secret_token?: string;
  allowed_updates?: string[];
  drop_pending_updates?: boolean;
}): Promise<true> {
  return call<true>("setWebhook", opts);
}

export function deleteWebhook(opts?: {
  drop_pending_updates?: boolean;
}): Promise<true> {
  return call<true>("deleteWebhook", opts ?? {});
}

export function getWebhookInfo(): Promise<{
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}> {
  return call("getWebhookInfo");
}

// Telegram MarkdownV2 escaping: a strict set of reserved characters must be
// backslash-escaped or the whole message is rejected. We keep the bot output
// in plain Markdown (legacy) for simplicity — fewer escape pitfalls — but
// expose this helper for the rare case where MarkdownV2 is needed.
export function escapeMarkdownV2(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`);
}
