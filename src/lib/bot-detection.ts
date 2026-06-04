// User-Agent → bot name classifier. Order matters: most specific patterns
// first, generic "bot|crawler|spider" fallback last. Returns null for
// requests that don't look like a bot.
//
// This module is intentionally dependency-free so it can run in Edge Runtime
// (used from middleware.ts).

const BOT_PATTERNS: Array<[RegExp, string]> = [
  // Search engines
  [/googlebot/i, "googlebot"],
  [/bingbot/i, "bingbot"],
  [/duckduckbot/i, "duckduckbot"],
  [/yandexbot/i, "yandexbot"],
  [/baiduspider/i, "baiduspider"],
  [/applebot/i, "applebot"],
  [/slurp/i, "yahoo"],

  // AI / LLM crawlers
  [/gptbot/i, "gptbot"],
  [/chatgpt-user/i, "chatgpt-user"],
  [/claudebot|anthropic-ai/i, "claudebot"],
  [/perplexitybot/i, "perplexitybot"],
  [/ccbot|commoncrawl/i, "commoncrawl"],
  [/google-extended/i, "google-extended"],
  [/meta-externalagent|meta-externalfetcher/i, "meta-ai"],
  [/youbot/i, "youbot"],
  [/cohere-ai/i, "cohere-ai"],
  [/bytespider/i, "bytespider"],

  // Social / link unfurlers
  [/facebookexternalhit|facebookbot/i, "facebook"],
  [/twitterbot/i, "twitterbot"],
  [/linkedinbot/i, "linkedinbot"],
  [/slackbot|slack-imgproxy/i, "slackbot"],
  [/discordbot/i, "discordbot"],
  [/whatsapp/i, "whatsapp"],
  [/telegrambot/i, "telegrambot"],

  // SEO tools
  [/ahrefsbot/i, "ahrefsbot"],
  [/semrushbot/i, "semrushbot"],
  [/mj12bot/i, "mj12bot"],
  [/dotbot/i, "dotbot"],
  [/petalbot/i, "petalbot"],
  [/screaming\s*frog/i, "screamingfrog"],

  // Monitoring / health checks
  [/uptimerobot/i, "uptimerobot"],
  [/pingdom/i, "pingdom"],
  [/statuscake/i, "statuscake"],
  [/site24x7/i, "site24x7"],

  // Generic fallback
  [/bot|crawler|spider|scraper/i, "other-bot"],
];

export function detectBot(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  for (const [pattern, name] of BOT_PATTERNS) {
    if (pattern.test(userAgent)) return name;
  }
  return null;
}
