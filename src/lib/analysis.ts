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
const MAX_SEARCHES = 20;
const LINK_CHECK_TIMEOUT_MS = 4000;
const LINK_CHECK_CONCURRENCY = 8;
const LINK_CHECK_USER_AGENT =
  "Mozilla/5.0 (compatible; IDEAA-LinkCheck/1.0; +https://ideaa.app)";
const BROKEN_LINK_NOTE = "*(Link nicht erreichbar)*";

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!cachedClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local for local dev or to Vercel project env in production.",
      );
    }
    // maxRetries: 4 retries on 408/409/429/5xx + connection errors, with
    // exponential backoff baked into the SDK. Default is 2; bump because a
    // single analysis costs ~$0.30 and silent failures from transient 429s
    // were stranding ideas in 'failed' for no good reason.
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
          content: `## INPUT\n${idea.raw_text}\n\n## OUTPUT\n\nReminder: respond in the same language as the INPUT above (see the Language hard rule in the system prompt). If the INPUT is German, the entire OUTPUT below — including translated section headings — must be in German.\n`,
        },
      ],
    });

    const trace = extractToolTrace(response.content);
    const rawReport = extractText(response.content);
    if (!rawReport) {
      throw new Error("Empty response from analysis model.");
    }
    const { report, brokenUrls } = await verifyAndAnnotateLinks(rawReport);
    const finalTrace: ToolTraceEntry[] =
      brokenUrls.length > 0
        ? [
            ...trace,
            {
              kind: "link_check",
              broken_count: brokenUrls.length,
              broken_urls: brokenUrls,
            },
          ]
        : trace;
    await saveAnalysisReady(
      idea.id,
      report,
      finalTrace.length > 0 ? finalTrace : null,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await saveAnalysisFailed(idea.id, message);
  }
}

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function extractMarkdownLinkUrls(markdown: string): string[] {
  const urls = new Set<string>();
  for (const match of markdown.matchAll(MARKDOWN_LINK_RE)) {
    urls.add(match[2]);
  }
  return [...urls];
}

// SSRF guard: the URLs we check come from the LLM, which can emit arbitrary
// strings. Refuse anything that isn't a public https:// URL so a fabricated
// link to a metadata service or internal host can't be probed from inside
// the Vercel function.
function isPublicHttpsUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  // IPv4 literal in RFC1918 / loopback / link-local ranges, plus 0.0.0.0.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  // IPv6 literals: bracketed in the host slot. Block loopback, link-local,
  // unique-local, IPv4-mapped private ranges.
  if (host.startsWith("[") && host.endsWith("]")) {
    const v6 = host.slice(1, -1).toLowerCase();
    if (v6 === "::1" || v6 === "::") return false;
    if (v6.startsWith("fe80:") || v6.startsWith("fc") || v6.startsWith("fd")) return false;
    if (v6.startsWith("::ffff:")) return false;
  }
  return true;
}

async function checkUrl(url: string): Promise<boolean> {
  if (!isPublicHttpsUrl(url)) {
    // Treat as broken so the link gets annotated; never send the request.
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS);
  const init: RequestInit = {
    method: "HEAD",
    redirect: "follow",
    signal: controller.signal,
    headers: {
      "user-agent": LINK_CHECK_USER_AGENT,
      accept: "*/*",
    },
  };
  try {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch {
      clearTimeout(timer);
      return false;
    }
    // Some hosts dislike HEAD — retry with GET on 405 / 501.
    if (res.status === 405 || res.status === 501) {
      try {
        res = await fetch(url, { ...init, method: "GET" });
      } catch {
        clearTimeout(timer);
        return false;
      }
    }
    clearTimeout(timer);
    if (res.status >= 200 && res.status < 400) return true;
    // Bot-protection-y codes: keep the link, treat as probably OK.
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      return true;
    }
    // 404, 410, 5xx → broken.
    return false;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

async function checkUrlsConcurrent(
  urls: string[],
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const idx = cursor++;
      const u = urls[idx];
      out[u] = await checkUrl(u);
    }
  }
  const workers = Array.from(
    { length: Math.min(LINK_CHECK_CONCURRENCY, urls.length) },
    worker,
  );
  await Promise.all(workers);
  return out;
}

/**
 * Walk every `[Label](URL)` link in the report and replace broken ones with
 * `[Label] *(Link nicht erreichbar)*` so the claim survives but the dead URL
 * does not. Bot-protection 4xx responses are treated as live to avoid false
 * positives on Reddit / X / paywalled news sites.
 */
export async function verifyAndAnnotateLinks(
  markdown: string,
): Promise<{ report: string; brokenUrls: string[] }> {
  const urls = extractMarkdownLinkUrls(markdown);
  if (urls.length === 0) return { report: markdown, brokenUrls: [] };
  const status = await checkUrlsConcurrent(urls);
  const brokenUrls = urls.filter((u) => status[u] === false);
  if (brokenUrls.length === 0) return { report: markdown, brokenUrls: [] };
  const brokenSet = new Set(brokenUrls);
  const rewritten = markdown.replace(
    MARKDOWN_LINK_RE,
    (full, label: string, url: string) =>
      brokenSet.has(url) ? `${label} ${BROKEN_LINK_NOTE}` : full,
  );
  return { report: rewritten, brokenUrls };
}
