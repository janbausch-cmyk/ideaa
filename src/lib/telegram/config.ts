// Centralised env-var access so route handlers don't sprinkle process.env reads.

export type TelegramConfig = {
  botToken: string;
  webhookSecret: string | null;
  allowedUserIds: Set<bigint>;
  janPaperclipUserId: string | null;
  cronSecret: string | null;
  publicAppUrl: string | null;
  paperclipUiPrefix: string; // e.g. "IDEAA"
};

function parseAllowedIds(raw: string | undefined): Set<bigint> {
  if (!raw) return new Set();
  const set = new Set<bigint>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      set.add(BigInt(trimmed));
    } catch {
      // Skip malformed entries rather than failing the whole bot.
    }
  }
  return set;
}

export function getTelegramConfig(): TelegramConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return {
    botToken,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? null,
    allowedUserIds: parseAllowedIds(process.env.TELEGRAM_ALLOWED_USER_IDS),
    janPaperclipUserId: process.env.JAN_PAPERCLIP_USER_ID ?? null,
    cronSecret: process.env.CRON_SECRET ?? null,
    publicAppUrl:
      process.env.TELEGRAM_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null),
    paperclipUiPrefix: process.env.PAPERCLIP_UI_PREFIX ?? "IDEAA",
  };
}

export function isAllowedTelegramUser(
  config: TelegramConfig,
  telegramUserId: number | bigint,
): boolean {
  if (config.allowedUserIds.size === 0) return false; // fail-closed
  return config.allowedUserIds.has(BigInt(telegramUserId));
}

export function paperclipIssueUrl(
  prefix: string,
  identifier: string,
  publicBase: string | null,
): string {
  const path = `/${prefix}/issues/${identifier}`;
  if (!publicBase) return path;
  // `publicBase` here refers to the Paperclip UI host, not the Vercel app.
  // We let callers pass null (path-only) when they don't have one configured.
  return `${publicBase.replace(/\/$/, "")}${path}`;
}
