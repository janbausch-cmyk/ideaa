import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { ANALYSIS_SYSTEM_PROMPT } from "./analysis-prompt";
import {
  getIdea,
  markAnalysisStarted,
  saveAnalysisFailed,
  saveAnalysisReady,
} from "./db";

const ANALYSIS_MODEL = "claude-opus-4-7";
const MAX_TOKENS = 2400;
const TEMPERATURE = 0.4;

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

function extractText(
  content: Anthropic.Messages.ContentBlock[],
): string {
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === "text") {
      parts.push(block.text);
    }
  }
  return parts.join("\n").trim();
}

export async function analyzeIdea(ideaId: string): Promise<void> {
  const idea = await getIdea(ideaId);
  if (!idea) return;
  if (idea.status !== "processing") return;
  if (idea.analysis_started_at) return;

  await markAnalysisStarted(ideaId);

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: [
        {
          type: "text",
          text: ANALYSIS_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `## INPUT\n${idea.raw_text}\n\n## OUTPUT\n`,
        },
      ],
    });

    const report = extractText(response.content);
    if (!report) {
      throw new Error("Empty response from analysis model.");
    }
    await saveAnalysisReady(ideaId, report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await saveAnalysisFailed(ideaId, message);
  }
}
