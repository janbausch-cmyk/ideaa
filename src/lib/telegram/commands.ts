// Slash commands sent to the bot. Slice 4: /inbox, /status, /new.

import { sendMessage } from "./client";
import {
  getTelegramChat,
  getActiveIssueContext,
  setActiveIssueContext,
} from "./db";
import {
  createIssue,
  getIssue,
  listAssignedToUser,
  listCompanyGoals,
} from "./paperclip";
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
    "• `/new <titel>` — neues Issue anlegen (zugewiesen an dich, du delegierst weiter)",
    "",
    "Sonst: Text-Antwort wird Kommentar auf dem aktiven Issue. Mit `#IDEAA-XX` taggst du ein Issue, danach landen Folge-Antworten ohne Tag dort.",
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

  const ctx = chat ? await getActiveIssueContext(args.telegramUserId) : null;

  const lines = [
    "🩺 *Bridge-Status*",
    `• Mapped Paperclip-User: ${chat ? `\`${chat.paperclip_user_id}\`` : "❌ kein Mapping"}`,
    `• Offene Issues (Inbox): ${inboxCount}`,
    `• Aktiver Kontext: ${ctx?.active_issue_id ? `\`${ctx.active_issue_id}\`` : "—"}`,
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

  const chat = await getTelegramChat(args.telegramUserId);
  if (!chat) {
    await sendMessage({
      chat_id: args.chatId,
      text: "Kein Mapping zu einem Paperclip-User. Lass dich erst per `register-chat` registrieren.",
      reply_to_message_id: args.messageId,
    });
    return { ok: true, action: "command:new:no_mapping" };
  }

  // Resolve goal in priority order:
  //   1. TELEGRAM_NEW_DEFAULT_GOAL_ID env override
  //   2. goal of the chat's active context issue
  //   3. the company's only active goal (auto-default for single-goal companies)
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
        // fall through — no goal context, will try auto-default below
      }
    }
  }
  if (!goalId) {
    try {
      const goals = await listCompanyGoals();
      const active = goals.filter((g) => g.status === "active");
      if (active.length === 1) {
        goalId = active[0].id;
      }
    } catch {
      // fall through — auto-default failed, will report below
    }
  }

  if (!goalId) {
    await sendMessage({
      chat_id: args.chatId,
      text:
        "Konnte kein Default-Goal ermitteln. Setze `TELEGRAM_NEW_DEFAULT_GOAL_ID` oder tagge erst ein Issue mit `#IDEAA-XX`, bevor du `/new` rufst.",
      parse_mode: "Markdown",
      reply_to_message_id: args.messageId,
    });
    return { ok: true, action: "command:new:no_goal" };
  }

  // Assign new issue to the chat user (not an agent), so the bot can
  // continue to comment/edit it from the chat. The user delegates to an
  // agent themselves later via the web UI or by tagging in a comment.
  // Paperclip's permission model rejects an "outside" agent posting
  // comments on an issue assigned to a different agent.

  try {
    const config = getTelegramConfig();
    const issue = await createIssue({
      title: args.title,
      goalId,
      parentId: parentId ?? undefined,
      assigneeUserId: chat.paperclip_user_id,
    });
    // Pin the new issue as the chat's active context so a follow-up text
    // reply lands on it without needing a #-tag.
    await setActiveIssueContext(args.telegramUserId, issue.id);
    const link = paperclipIssueUrl(
      config.paperclipUiPrefix,
      issue.identifier,
      null,
    );
    await sendMessage({
      chat_id: args.chatId,
      text:
        `✅ Angelegt: *${issue.identifier}* — ${issue.title}\n` +
        `Zugewiesen an dich. Im Web kannst du es an einen Agenten weiterreichen.\n` +
        `${link}`,
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
