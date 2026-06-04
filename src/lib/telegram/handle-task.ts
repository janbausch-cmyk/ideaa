// Route an LLM-classified "task" intent to the existing /new command, so we
// reuse its goal/assignee resolution logic instead of duplicating it.

import "server-only";

import { dispatchCommand } from "./commands";

export async function handleTaskCreate(args: {
  telegramUserId: number;
  chatId: number;
  messageId: number;
  title: string;
}): Promise<{ ok: boolean; action: string; detail?: string }> {
  return dispatchCommand({
    text: `/new ${args.title}`,
    telegramUserId: args.telegramUserId,
    chatId: args.chatId,
    messageId: args.messageId,
  });
}
