import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { DEEPDIVE_SYSTEM_PROMPT } from "./deepdive-prompt";
import {
  claimDeepdive,
  saveDeepdiveFailed,
  saveDeepdiveReady,
  type IdeaRow,
  type ToolTraceEntry,
} from "./db";

const DEEPDIVE_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8000;
const MAX_SEARCHES = 8;

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

function extractToolTrace(
  content: Anthropic.Messages.ContentBlock[],
): ToolTraceEntry[] {
  const trace: ToolTraceEntry[] = [];
  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "web_search") {
      const input =
        block.input && typeof block.input === "object"
          ? (block.input as Record<string, unknown>)
          : {};
      const query = typeof input.query === "string" ? input.query : undefined;
      trace.push({
        kind: "search_request",
        tool_use_id: block.id,
        input: { ...input, query },
      });
    } else if (block.type === "web_search_tool_result") {
      const c = block.content;
      if (Array.isArray(c)) {
        const urls = c
          .map((r) => (r.type === "web_search_result" ? r.url : null))
          .filter((u): u is string => Boolean(u));
        trace.push({
          kind: "search_result",
          tool_use_id: block.tool_use_id,
          result_count: c.length,
          urls,
        });
      } else {
        trace.push({
          kind: "search_result",
          tool_use_id: block.tool_use_id,
          result_count: 0,
          urls: [],
          error: c.error_code,
        });
      }
    }
  }
  return trace;
}

function buildUserMessage(idea: IdeaRow): string {
  const hasReport = idea.analysis_report && idea.analysis_report.trim().length > 0;
  const reportBlock = hasReport
    ? `## EXISTING VALIDATION REPORT (from the first analysis pass — use it as context, do not repeat it verbatim)\n${idea.analysis_report}\n\n`
    : "";
  return `## INPUT\n${idea.raw_text}\n\n${reportBlock}## OUTPUT\n\nReminder: respond in the same language as the INPUT above (Language hard rule in the system prompt). If the INPUT is German, the entire OUTPUT — including translated section headings — must be in German.\n`;
}

/**
 * Run the Anthropic deepdive ("Ausarbeitung") for an idea after the row has
 * been atomically transitioned to 'running' via claimDeepdive. Persists either
 * a 'done' or 'failed' terminal state on the row's deepdive_* columns.
 *
 * Logs token usage to stdout for cost tracking (v0 has no per-click budget).
 */
export async function runDeepdiveForIdea(idea: IdeaRow): Promise<void> {
  const startedAt = Date.now();
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: DEEPDIVE_MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: DEEPDIVE_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: MAX_SEARCHES,
        },
      ],
      messages: [
        { role: "user", content: buildUserMessage(idea) },
      ],
    });

    const trace = extractToolTrace(response.content);
    const report = extractText(response.content);
    if (!report) {
      throw new Error("Empty response from deepdive model.");
    }

    const usage = response.usage as
      | { input_tokens?: number; output_tokens?: number }
      | undefined;
    const inputTokens = usage?.input_tokens ?? null;
    const outputTokens = usage?.output_tokens ?? null;

    await saveDeepdiveReady(
      idea.id,
      report,
      trace.length > 0 ? trace : null,
      {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        model: DEEPDIVE_MODEL,
      },
    );

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[deepdive] id=${idea.id} ok elapsed_ms=${elapsedMs} input_tokens=${inputTokens ?? "?"} output_tokens=${outputTokens ?? "?"} searches=${trace.filter((t) => t.kind === "search_request").length} report_chars=${report.length}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await saveDeepdiveFailed(idea.id, message);
    const elapsedMs = Date.now() - startedAt;
    console.error(
      `[deepdive] id=${idea.id} fail elapsed_ms=${elapsedMs} error=${message}`,
    );
  }
}

/**
 * Claim and run a deepdive for `id` in one call. Used by the admin server
 * action (triggered via `after()` so the user redirect is not blocked on the
 * LLM call). Returns the claim outcome so the caller can log skipped clicks.
 */
export async function startDeepdiveForId(id: string): Promise<{ claimed: boolean }> {
  const idea = await claimDeepdive(id);
  if (!idea) return { claimed: false };
  await runDeepdiveForIdea(idea);
  return { claimed: true };
}
