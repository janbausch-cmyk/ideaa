import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import {
  PLATFORM_REPORT_SYSTEM_PROMPT,
  buildPlatformReportUserMessage,
} from "./platform-report-prompt";
import {
  insertWeeklyPlatformReport,
  type ToolTraceEntry,
  type WeeklyPlatformReportRow,
} from "./db";

const MODEL = "claude-opus-4-7";
const MAX_TOKENS = 4500;
const MAX_SEARCHES = 18;

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!cachedClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local for local dev or to Vercel project env in production.",
      );
    }
    cachedClient = new Anthropic({ apiKey });
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

/**
 * Returns the ISO-week Monday (00:00 UTC) for a given date. Used to anchor
 * weekly reports to a stable bucket key regardless of when in the week the
 * generator runs.
 */
export function weekStartAtFor(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Run the LLM, persist a new weekly platform-positioning report. Always
 * inserts a new row (one per run); we don't dedup by week so manual re-runs
 * remain useful. Caller decides whether to bucket by week_start_at.
 */
export async function generateAndPersistWeeklyPlatformReport(
  weekStartAt: Date = weekStartAtFor(),
): Promise<WeeklyPlatformReportRow> {
  const startedAt = Date.now();
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: PLATFORM_REPORT_SYSTEM_PROMPT,
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
      {
        role: "user",
        content: buildPlatformReportUserMessage({ weekStartAt }),
      },
    ],
  });

  const trace = extractToolTrace(response.content);
  const body = extractText(response.content);
  if (!body) {
    throw new Error("Empty response from platform-report model.");
  }
  const usage = response.usage as
    | { input_tokens?: number; output_tokens?: number }
    | undefined;
  const inputTokens = usage?.input_tokens ?? null;
  const outputTokens = usage?.output_tokens ?? null;

  const row = await insertWeeklyPlatformReport({
    weekStartAt,
    body,
    toolTrace: trace.length > 0 ? trace : null,
    inputTokens,
    outputTokens,
    model: MODEL,
  });

  const elapsedMs = Date.now() - startedAt;
  console.log(
    `[platform-report] week=${weekStartAt.toISOString().slice(0, 10)} ok elapsed_ms=${elapsedMs} input_tokens=${inputTokens ?? "?"} output_tokens=${outputTokens ?? "?"} searches=${trace.filter((t) => t.kind === "search_request").length} body_chars=${body.length}`,
  );
  return row;
}
