// Pull: incoming Telegram updates → Paperclip actions.
// Routes text replies (active-context comment or explicit #IDEAA-N tag),
// inline-button callbacks, and slash commands. Voice transcription is
// stubbed pending Slice 3.

import {
  getActiveIssueContext,
  findPushedEventByMessageId,
} from "./db";
import {
  sendMessage,
  answerCallbackQuery,
  editMessageReplyMarkup,
} from "./client";
import {
  postComment,
  patchIssue,
  type IssueSummary,
} from "./paperclip";
import { dispatchCommand } from "./commands";
import { getTelegramConfig, isAllowedTelegramUser, paperclipIssueUrl } from "./config";

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number };
    date: number;
    text?: string;
    voice?: { file_id: string; duration: number; mime_type?: string };
    reply_to_message?: { message_id: number };
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string; first_name?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
};

const ISSUE_TAG_RE = /\B#([A-Z]+-\d+)\b/;

export async function handleUpdate(update: TelegramUpdate): Promise<{
  ok: boolean;
  action: string;
  detail?: string;
}> {
  const config = getTelegramConfig();

  if (update.callback_query) {
    return handleCallbackQuery(update.callback_query, config);
  }

  const msg = update.message;
  if (!msg || !msg.from) return { ok: true, action: "skip:no_message" };

  if (!isAllowedTelegramUser(config, msg.from.id)) {
    return { ok: true, action: "skip:unauthorised" };
  }

  if (msg.voice) {
    // Voice transcription lands in Slice 3. For now ack and tell the user.
    await sendMessage({
      chat_id: msg.chat.id,
      text: "🎙️ Sprachnachrichten kommen bald — Transkription wird gerade gebaut.",
      reply_to_message_id: msg.message_id,
    });
    return { ok: true, action: "voice:not_implemented" };
  }

  const text = msg.text?.trim();
  if (!text) return { ok: true, action: "skip:empty" };

  if (text.startsWith("/")) {
    return dispatchCommand({
      text,
      telegramUserId: msg.from.id,
      chatId: msg.chat.id,
      messageId: msg.message_id,
    });
  }

  return handleTextReply({
    telegramUserId: msg.from.id,
    chatId: msg.chat.id,
    messageId: msg.message_id,
    text,
    config,
  });
}

async function handleTextReply(args: {
  telegramUserId: number;
  chatId: number;
  messageId: number;
  text: string;
  config: ReturnType<typeof getTelegramConfig>;
}): Promise<{ ok: boolean; action: string; detail?: string }> {
  const { telegramUserId, chatId, messageId, text, config } = args;

  // 1. Explicit issue tag wins.
  const tag = text.match(ISSUE_TAG_RE);
  let targetIssueId: string | null = null;
  let body = text;
  if (tag) {
    targetIssueId = tag[1]; // Paperclip API accepts identifier in the issue path
    body = text.replace(tag[0], "").trim();
  } else {
    // 2. Fall back to active context.
    const ctx = await getActiveIssueContext(telegramUserId);
    targetIssueId = ctx?.active_issue_id ?? null;
  }

  if (!targetIssueId) {
    await sendMessage({
      chat_id: chatId,
      text:
        "Kein aktives Issue. Tagge ein Issue mit `#IDEAA-XX` oder warte auf eine Push-Nachricht.",
      parse_mode: "Markdown",
      reply_to_message_id: messageId,
    });
    return { ok: true, action: "reply:no_context" };
  }

  if (!body) {
    await sendMessage({
      chat_id: chatId,
      text: "Leerer Kommentar nach dem Tag — nichts gepostet.",
      reply_to_message_id: messageId,
    });
    return { ok: true, action: "reply:empty_after_tag" };
  }

  try {
    await postComment(targetIssueId, body);
    const link = paperclipIssueUrl(
      config.paperclipUiPrefix,
      targetIssueId,
      null,
    );
    await sendMessage({
      chat_id: chatId,
      text: `💬 Kommentiert auf ${link}`,
      reply_to_message_id: messageId,
      disable_web_page_preview: true,
    });
    return { ok: true, action: "reply:commented", detail: targetIssueId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendMessage({
      chat_id: chatId,
      text: `⚠️ Kommentar fehlgeschlagen: ${message.slice(0, 280)}`,
      reply_to_message_id: messageId,
    });
    return { ok: true, action: "reply:error", detail: message };
  }
}

async function handleCallbackQuery(
  q: NonNullable<TelegramUpdate["callback_query"]>,
  config: ReturnType<typeof getTelegramConfig>,
): Promise<{ ok: boolean; action: string; detail?: string }> {
  if (!isAllowedTelegramUser(config, q.from.id)) {
    await answerCallbackQuery({
      callback_query_id: q.id,
      text: "Nicht autorisiert.",
      show_alert: true,
    });
    return { ok: true, action: "callback:unauthorised" };
  }

  const data = q.data ?? "";
  const [verb, issueId] = data.split(":", 2);
  const msg = q.message;

  // Confirm the original push event exists, so we know the issueId is one we
  // sent ourselves.
  if (msg) {
    const original = await findPushedEventByMessageId(q.from.id, msg.message_id);
    if (!original || original.paperclip_issue_id !== issueId) {
      await answerCallbackQuery({
        callback_query_id: q.id,
        text: "Diese Aktion ist nicht mehr gültig.",
      });
      return { ok: true, action: "callback:unknown_event" };
    }
  }

  let result: { issue?: IssueSummary; ackText: string; status?: string };
  try {
    if (verb === "accept") {
      await patchIssue(issueId, {
        status: "in_progress",
        comment: "Akzeptiert via Telegram.",
      });
      result = { ackText: "Akzeptiert ✅", status: "Akzeptiert" };
    } else if (verb === "reject") {
      await patchIssue(issueId, {
        status: "cancelled",
        comment: "Abgelehnt via Telegram.",
      });
      result = { ackText: "Abgelehnt ❌", status: "Abgelehnt" };
    } else if (verb === "defer") {
      await patchIssue(issueId, {
        status: "backlog",
        comment: "Auf später verschoben via Telegram.",
      });
      result = { ackText: "Verschoben ⏰", status: "Verschoben" };
    } else {
      await answerCallbackQuery({
        callback_query_id: q.id,
        text: `Unbekannte Aktion: ${verb}`,
      });
      return { ok: true, action: `callback:unknown_verb:${verb}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await answerCallbackQuery({
      callback_query_id: q.id,
      text: `Fehler: ${message.slice(0, 180)}`,
      show_alert: true,
    });
    return { ok: true, action: "callback:error", detail: message };
  }

  await answerCallbackQuery({
    callback_query_id: q.id,
    text: result.ackText,
  });

  // Clear the inline keyboard so the same action can't be repeated.
  if (msg) {
    try {
      await editMessageReplyMarkup({
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        reply_markup: { inline_keyboard: [] },
      });
    } catch {
      // Edit can fail if the message is too old — toast above is enough.
    }
  }

  return { ok: true, action: `callback:${verb}:ok`, detail: issueId };
}
