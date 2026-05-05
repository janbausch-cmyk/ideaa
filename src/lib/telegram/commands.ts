// Slash commands sent to the bot. Slice 4: /inbox, /status, /new.

import { sendMessage } from "./client";
import {
  getTelegramChat,
  getActiveIssueContext,
  ensureTelegramSchema,
} from "./db";
import {
  createIssue,
  getIssue,
  listAssignedToUser,
} from "./paperclip";
import { getSql } from "@/lib/db";
import { getTelegramConfig, paperclipIssueUrl } from "./config";

export type CommandResult = {
  ok: boolean;
  action: string;
  detail?: string;
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

export async function dispatchCommand(args: {
  text: string;
  telegramUserId: number;
  chatId: number;
  messageId: number;
}): Promise<CommandResult> {
  const trimmed = args.text.trim();
  const spaceIdx = trimmed.indexOf(" ");
  const cmd = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
  const rest = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  if (cmd === "/inbox") return cmdInbox(args);
  if (cmd === "/status") return cmdStatus(args);
  if (cmd === "/new") return cmdNew({ ...args, title: rest });
  if (cmd === "/start" || cmd === "/help") return cmdHelp(args);

  await sendMessage({
    chat_id: args.chatId,
    text: `Unbekannter Befehl: ${cmd}. Verfügbar: /inbox, /status, /new <titel>, /help.`,
    reply_to_message_id: args.messageId,
  });
  return { ok: true, action: `command:unknown:${cmd}` };
}

async function cmdHelp(args: {
  chatId: number;
  messageId: number;
}): Promise<CommandResult> {
  const lines = [
    "🤖 *IDEAA Telegram-Bridge*",
    "",
    "Befehle:",
    "• `/inbox` — deine offenen Paperclip-Aufgaben",
    "• `/status` — kurzer Health-Check der Bridge",
    "• `/new <titel>` — neues Issue anlegen (erbt das Goal vom letzten Push-Issue)",
    "",
    "Sonst: Text-Antwort wird Kommentar auf dem zuletzt gepushten Issue. Mit `#IDEAA-XX` kannst du explizit ein Issue taggen.",
  ];
  await sendMessage({
    chat_id: args.chatId,
    text: lines.join("\n"),
    parse_mode: "Markdown",
    reply_to_message_id: args.messageId,
  });
  return { ok: true, action: "command:help" };
}

async function cmdInbox(args: {
  telegramUserId: number;
  chatId: number;
  messageId: number;
}): Promise<CommandResult> {
  const config = getTelegramConfig();
  const chat = await getTelegramChat(args.telegramUserId);
  if (!chat) {
    await sendMessage({
      chat_id: args.chatId,
      text: "Kein Mapping zu einem Paperclip-User. Lass dich erst per `register-chat` registrieren.",
      reply_to_message_id: args.messageId,
    });
    return { ok: true, action: "command:inbox:no_mapping" };
  }

  let issues;
  try {
    issues = await listAssignedToUser(chat.paperclip_user_id, { limit: 25 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendMessage({
      chat_id: args.chatId,
      text: `⚠️ Inbox konnte nicht geladen werden: ${message.slice(0, 240)}`,
      reply_to_message_id: args.messageId,
    });
    return { ok: true, action: "command:inbox:error", detail: message };
  }

  if (issues.length === 0) {
    await sendMessage({
      chat_id: args.chatId,
      text: "📭 Inbox leer — keine offenen Aufgaben.",
      reply_to_message_id: args.messageId,
    });
    return { ok: true, action: "command:inbox:empty" };
  }

  // Sort by status (active first) then priority then updatedAt desc.
  const statusRank: Record<string, number> = {
    in_progress: 0,
    in_review: 1,
    todo: 2,
    blocked: 3,
  };
  const priorityRank: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  issues.sort((a, b) => {
    const sa = statusRank[a.status] ?? 9;
    const sb = statusRank[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    const pa = priorityRank[a.priority] ?? 9;
    const pb = priorityRank[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const lines = [
    `📋 *Inbox* — ${issues.length} offen`,
    "",
    ...issues.slice(0, 20).map((issue) => {
      const link = paperclipIssueUrl(
        config.paperclipUiPrefix,
        issue.identifier,
        null,
      );
      const badge = PRIORITY_BADGE[issue.priority] ?? "·";
      return `${badge} *${issue.identifier}* — ${issue.title} _(${issue.status})_\n${link}`;
    }),
  ];
  if (issues.length > 20) {
    lines.push(`\n…und ${issues.length - 20} weitere.`);
  }
  await sendMessage({
    chat_id: args.chatId,
    text: lines.join("\n"),
    parse_mode: "Markdown",
    disable_web_page_preview: true,
    reply_to_message_id: args.messageId,
  });
  return { ok: true, action: "command:inbox:ok", detail: String(issues.length) };
}

async function cmdStatus(args: {
  telegramUserId: number;
  chatId: number;
  messageId: number;
}): Promise<CommandResult> {
  const chat = await getTelegramChat(args.telegramUserId);

  let inboxCount: number | string = "?";
  if (chat) {
    try {
      const issues = await listAssignedToUser(chat.paperclip_user_id, { limit: 100 });
      inboxCount = issues.length;
    } catch {
      inboxCount = "n/a";
    }
  }

  let pushed24h: number | string = "?";
  let lastPushAt: string | null = null;
  try {
    await ensureTelegramSchema();
    const sql = getSql();
    const rows = (await sql`
      SELECT count(*)::int AS n,
             max(created_at) AS last_at
      FROM telegram_pushed_events
      WHERE telegram_user_id = ${args.telegramUserId.toString()}::bigint
        AND created_at > now() - interval '24 hours'
    `) as Array<{ n: number; last_at: string | null }>;
    pushed24h = rows[0]?.n ?? 0;
    lastPushAt = rows[0]?.last_at ?? null;
  } catch {
    pushed24h = "n/a";
  }

  const lines = [
    "🩺 *Bridge-Status*",
    `• Mapped Paperclip-User: ${chat ? `\`${chat.paperclip_user_id}\`` : "❌ kein Mapping"}`,
    `• Offene Issues (Inbox): ${inboxCount}`,
    `• Push-Events (24h): ${pushed24h}`,
    `• Letzter Push: ${lastPushAt ? new Date(lastPushAt).toISOString() : "—"}`,
  ];
  await sendMessage({
    chat_id: args.chatId,
    text: lines.join("\n"),
    parse_mode: "Markdown",
    reply_to_message_id: args.messageId,
  });
  return { ok: true, action: "command:status:ok" };
}

async function cmdNew(args: {
  title: string;
  telegramUserId: number;
  chatId: number;
  messageId: number;
}): Promise<CommandResult> {
  if (!args.title) {
    await sendMessage({
      chat_id: args.chatId,
      text: "Nutzung: `/new <titel>` — z.B. `/new Health-Endpoint absichern`",
      parse_mode: "Markdown",
      reply_to_message_id: args.messageId,
    });
    return { ok: true, action: "command:new:no_title" };
  }

  // Resolve goal: env override → goal of last push-context issue → fail.
  let goalId = process.env.TELEGRAM_NEW_DEFAULT_GOAL_ID ?? null;
  let parentId: string | null = null;
  if (!goalId) {
    const ctx = await getActiveIssueContext(args.telegramUserId);
    if (ctx?.active_issue_id) {
      try {
        const ctxIssue = await getIssue(ctx.active_issue_id);
        goalId = ctxIssue.goalId ?? null;
        parentId = ctxIssue.parentId ?? null;
      } catch {
        // fall through — no goal context, will report below
      }
    }
  }

  if (!goalId) {
    await sendMessage({
      chat_id: args.chatId,
      text:
        "Konnte kein Default-Goal ermitteln. Setze `TELEGRAM_NEW_DEFAULT_GOAL_ID` oder erst ein Issue per Push als Kontext setzen.",
      reply_to_message_id: args.messageId,
    });
    return { ok: true, action: "command:new:no_goal" };
  }

  const assigneeAgentId =
    process.env.TELEGRAM_NEW_DEFAULT_ASSIGNEE_AGENT_ID ?? undefined;

  try {
    const config = getTelegramConfig();
    const issue = await createIssue({
      title: args.title,
      goalId,
      parentId: parentId ?? undefined,
      assigneeAgentId,
    });
    const link = paperclipIssueUrl(
      config.paperclipUiPrefix,
      issue.identifier,
      null,
    );
    await sendMessage({
      chat_id: args.chatId,
      text: `✅ Angelegt: *${issue.identifier}* — ${issue.title}\n${link}`,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      reply_to_message_id: args.messageId,
    });
    return { ok: true, action: "command:new:ok", detail: issue.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendMessage({
      chat_id: args.chatId,
      text: `⚠️ Anlegen fehlgeschlagen: ${message.slice(0, 280)}`,
      reply_to_message_id: args.messageId,
    });
    return { ok: true, action: "command:new:error", detail: message };
  }
}
