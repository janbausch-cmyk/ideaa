import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { COPY_TOOLKIT_SYSTEM_PROMPT } from "./copy-toolkit-prompt";
import {
  saveCopyToolkitFailed,
  saveCopyToolkitReady,
  type IdeaRow,
} from "./db";

const COPY_TOOLKIT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4000;

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!cachedClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local for local dev or to Vercel project env in production.",
      );
    }
    cachedClient = new Anthropic({ apiKey, maxRetries: 4 });
  }
  return cachedClient;
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "text") {
      parts.push(block.text);
    }
  }
  return parts.join("\n").trim();
}

function buildUserMessage(idea: IdeaRow): string {
  const reportBlock =
    idea.analysis_report && idea.analysis_report.trim().length > 0
      ? `## VALIDATION REPORT (from the analysis pass — use it to ground the wedge, customer, alternatives, and 30-day plan)\n${idea.analysis_report}\n\n`
      : "";
  return `## INPUT\n${idea.raw_text}\n\n${reportBlock}## OUTPUT\n\nReminder: respond in the same language as the INPUT above. If the INPUT is German, the entire toolkit — including translated section headings — is in German.\n`;
}

/**
 * Generate the Copy-Baukasten (interview script, landing copy, ad variants,
 * waitlist text, cold DM) for an idea that already has an analysis report.
 * Writes copy_toolkit_* columns via saveCopyToolkitReady / saveCopyToolkitFailed.
 *
 * Called from analyzeClaimedIdea after saveAnalysisReady succeeds. Failures
 * here are logged but do NOT surface as an analysis failure — the report is
 * already saved and visible to the user.
 */
export async function runCopyToolkitForIdea(idea: IdeaRow): Promise<void> {
  const startedAt = Date.now();
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: COPY_TOOLKIT_MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: COPY_TOOLKIT_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildUserMessage(idea) }],
    });

    const report = extractText(response.content);
    if (!report) {
      throw new Error("Empty response from copy-toolkit model.");
    }

    const usage = response.usage as
      | { input_tokens?: number; output_tokens?: number }
      | undefined;
    const inputTokens = usage?.input_tokens ?? null;
    const outputTokens = usage?.output_tokens ?? null;

    await saveCopyToolkitReady(idea.id, report, {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model: COPY_TOOLKIT_MODEL,
    });

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[copy-toolkit] id=${idea.id} ok elapsed_ms=${elapsedMs} input_tokens=${inputTokens ?? "?"} output_tokens=${outputTokens ?? "?"} report_chars=${report.length}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await saveCopyToolkitFailed(idea.id, message);
    const elapsedMs = Date.now() - startedAt;
    console.error(
      `[copy-toolkit] id=${idea.id} fail elapsed_ms=${elapsedMs} error=${message}`,
    );
  }
}
