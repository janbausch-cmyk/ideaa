// Submit a free-text Telegram message as an IDEAA idea.
// Persists to the ideas table, kicks the worker, and replies with the
// shareable URL.

import "server-only";

import { after } from "next/server";

import { insertIdea } from "../db";
import { runWorkerTick } from "../worker";
import { sendMessage } from "./client";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "https://ideaa-two.vercel.app"
  );
}

export async function handleIdeaSubmit(args: {
  chatId: number;
  messageId: number;
  ideaText: string;
}): Promise<{ ok: boolean; action: string; detail?: string }> {
  const { chatId, messageId, ideaText } = args;

  let inserted;
  try {
    inserted = await insertIdea(ideaText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendMessage({
      chat_id: chatId,
      text: `⚠️ Konnte die Idee nicht speichern: ${message.slice(0, 240)}`,
      reply_to_message_id: messageId,
    });
    return { ok: true, action: "idea:insert_failed", detail: message };
  }

  const url = `${siteUrl()}/ideas/${inserted.id}`;
  await sendMessage({
    chat_id: chatId,
    text: `💡 Idee aufgenommen, Analyse läuft.\nIn ca. 60–90 Sek. fertig: ${url}`,
    reply_to_message_id: messageId,
    disable_web_page_preview: true,
  });

  // Kick the worker without blocking the response. Same pattern as the
  // submitIdea server action.
  after(async () => {
    try {
      await runWorkerTick();
    } catch (err) {
      console.error("[telegram idea] worker tick failed", err);
    }
  });

  return { ok: true, action: "idea:submitted", detail: inserted.id };
}
