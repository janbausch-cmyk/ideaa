// Push: walk Paperclip activity since the last cursor and emit Telegram
// messages for things Jan should see (new assignments, mentions, approvals).
// Slice 1: assignments only.

import { getTelegramConfig, paperclipIssueUrl } from "./config";
import {
  advancePushCursor,
  getOrInitPushCursor,
  listTelegramChats,
  recordPushedEvent,
  setActiveIssueContext,
  type TelegramChatRow,
} from "./db";
import { sendMessage } from "./client";
import { listAssignedToUser, type IssueSummary } from "./paperclip";

export type PushReport = {
  chats: number;
  assignments_pushed: number;
  errors: Array<{ telegram_user_id: string; message: string }>;
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: "🔴 critical",
  high: "🟠 high",
  medium: "🟡 medium",
  low: "🟢 low",
};

function formatAssignmentMessage(
  issue: IssueSummary,
  uiPrefix: string,
): string {
  const link = paperclipIssueUrl(uiPrefix, issue.identifier, null);
  const priority = PRIORITY_LABEL[issue.priority] ?? issue.priority;
  return [
    `📌 *Neue Aufgabe für dich*`,
    `*${issue.identifier}* — ${issue.title}`,
    `Priorität: ${priority}`,
    `Status: ${issue.status}`,
    `Link: ${link}`,
  ].join("\n");
}

function assignmentKeyboard(issueId: string) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Akzeptieren", callback_data: `accept:${issueId}` },
        { text: "❌ Ablehnen", callback_data: `reject:${issueId}` },
      ],
      [
        { text: "⏰ Später", callback_data: `defer:${issueId}` },
      ],
    ],
  };
}

async function pushAssignmentsForChat(
  chat: TelegramChatRow,
): Promise<{ pushed: number }> {
  const config = getTelegramConfig();
  const cursor = await getOrInitPushCursor(BigInt(chat.telegram_user_id));
  const issues = await listAssignedToUser(chat.paperclip_user_id, {
    updatedAfter: cursor.assignments_at,
    limit: 50,
  });
  // Sort oldest-first so the cursor only moves forward by one issue at a time
  // if any single send fails partway through.
  issues.sort(
    (a, b) =>
      new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
  );

  let pushed = 0;
  for (const issue of issues) {
    const text = formatAssignmentMessage(issue, config.paperclipUiPrefix);
    const sent = await sendMessage({
      chat_id: chat.telegram_chat_id,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      reply_markup: assignmentKeyboard(issue.id),
    });
    const recorded = await recordPushedEvent({
      telegramUserId: BigInt(chat.telegram_user_id),
      kind: "assignment",
      sourceId: issue.id,
      telegramMsgId: sent.message_id,
      paperclipIssueId: issue.id,
      payload: { identifier: issue.identifier, title: issue.title },
    });
    if (recorded.inserted) pushed += 1;
    // Last-pushed issue becomes the active reply context.
    await setActiveIssueContext(BigInt(chat.telegram_user_id), issue.id);
    await advancePushCursor(
      BigInt(chat.telegram_user_id),
      "assignments_at",
      issue.updatedAt,
    );
  }
  return { pushed };
}

export async function runPush(): Promise<PushReport> {
  const chats = await listTelegramChats();
  const report: PushReport = {
    chats: chats.length,
    assignments_pushed: 0,
    errors: [],
  };
  for (const chat of chats) {
    try {
      const { pushed } = await pushAssignmentsForChat(chat);
      report.assignments_pushed += pushed;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      report.errors.push({
        telegram_user_id: chat.telegram_user_id,
        message,
      });
    }
  }
  return report;
}
