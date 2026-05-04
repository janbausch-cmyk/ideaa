import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { ANALYSIS_SYSTEM_PROMPT } from "./analysis-prompt";
import {
  saveAnalysisFailed,
  saveAnalysisReady,
  type IdeaRow,
  type ToolTraceEntry,
} from "./db";

const ANALYSIS_MODEL = "claude-opus-4-7";
const MAX_TOKENS = 4000;
const MAX_SEARCHES = 15;

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
 * Run the Anthropic analysis for an idea that has already been claimed
 * (status='running'). Persists either a 'done' or 'failed' terminal state.
 *
 * Idempotency: if the model call fails, the row is marked 'failed' and the
 * worker stops touching it. The stale-running recovery in db.ts handles the
 * case where the worker process is killed mid-flight before we record either
 * outcome.
 */
export async function analyzeClaimedIdea(idea: IdeaRow): Promise<void> {
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: ANALYSIS_SYSTEM_PROMPT,
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
          content: `## INPUT\n${idea.raw_text}\n\n## OUTPUT\n`,
        },
      ],
    });

    const trace = extractToolTrace(response.content);
    const report = extractText(response.content);
    if (!report) {
      throw new Error("Empty response from analysis model.");
    }
    await saveAnalysisReady(idea.id, report, trace.length > 0 ? trace : null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await saveAnalysisFailed(idea.id, message);
  }
}
