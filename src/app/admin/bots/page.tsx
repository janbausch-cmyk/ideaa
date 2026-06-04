import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  adminBotVisitSummary,
  adminRecentBotVisits,
  adminTopBotPaths,
} from "@/lib/db";

export const dynamic = "force-dynamic";

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function botLabel(name: string): string {
  const map: Record<string, string> = {
    googlebot: "Google",
    bingbot: "Bing",
    duckduckbot: "DuckDuckGo",
    yandexbot: "Yandex",
    baiduspider: "Baidu",
    applebot: "Apple",
    yahoo: "Yahoo",
    gptbot: "OpenAI GPTBot",
    "chatgpt-user": "ChatGPT-User",
    claudebot: "Anthropic ClaudeBot",
    perplexitybot: "Perplexity",
    commoncrawl: "Common Crawl (CCBot)",
    "google-extended": "Google-Extended (LLM)",
    "meta-ai": "Meta AI",
    youbot: "You.com",
    "cohere-ai": "Cohere",
    bytespider: "ByteDance",
    facebook: "Facebook",
    twitterbot: "X/Twitter",
    linkedinbot: "LinkedIn",
    slackbot: "Slack",
    discordbot: "Discord",
    whatsapp: "WhatsApp",
    telegrambot: "Telegram",
    ahrefsbot: "Ahrefs",
    semrushbot: "Semrush",
    mj12bot: "Majestic (MJ12)",
    dotbot: "Moz (DotBot)",
    petalbot: "Huawei PetalBot",
    screamingfrog: "Screaming Frog",
    uptimerobot: "UptimeRobot",
    pingdom: "Pingdom",
    statuscake: "StatusCake",
    site24x7: "Site24x7",
    "other-bot": "Sonstige",
  };
  return map[name] ?? name;
}

export default async function AdminBotsPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const [summary, topPaths, recent] = await Promise.all([
    adminBotVisitSummary(),
    adminTopBotPaths(7, 20),
    adminRecentBotVisits(100),
  ]);

  const totalAllTime = summary.reduce((acc, s) => acc + s.total, 0);
  const total24h = summary.reduce((acc, s) => acc + s.visits_24h, 0);
  const total7d = summary.reduce((acc, s) => acc + s.visits_7d, 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Bot-Aktivität</h1>
        <p className="mt-1 text-sm text-[color:var(--foreground-muted)]">
          Crawler-Besuche werden in der Middleware getrackt (User-Agent-basiert)
          und hier aggregiert. Echte Browser-Aufrufe sind nicht enthalten.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="surface-card p-5">
          <div className="text-xs uppercase tracking-wider text-[color:var(--foreground-muted)]">
            Letzte 24h
          </div>
          <div className="mt-1 text-3xl font-bold">
            {total24h.toLocaleString("de-DE")}
          </div>
        </div>
        <div className="surface-card p-5">
          <div className="text-xs uppercase tracking-wider text-[color:var(--foreground-muted)]">
            Letzte 7 Tage
          </div>
          <div className="mt-1 text-3xl font-bold">
            {total7d.toLocaleString("de-DE")}
          </div>
        </div>
        <div className="surface-card p-5">
          <div className="text-xs uppercase tracking-wider text-[color:var(--foreground-muted)]">
            Gesamt erfasst
          </div>
          <div className="mt-1 text-3xl font-bold">
            {totalAllTime.toLocaleString("de-DE")}
          </div>
        </div>
      </section>

      <section className="surface-card overflow-hidden p-0">
        <div className="border-b border-[color:var(--border)] p-5">
          <h2 className="eyebrow">Pro Bot</h2>
        </div>
        {summary.length === 0 ? (
          <p className="p-5 text-sm text-[color:var(--foreground-muted)]">
            Noch keine Bot-Besuche erfasst. Sobald Crawler die Seite besuchen,
            tauchen sie hier auf.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-left text-xs uppercase tracking-wider text-[color:var(--foreground-muted)]">
                <th className="px-5 py-2 font-medium">Bot</th>
                <th className="px-5 py-2 text-right font-medium">24h</th>
                <th className="px-5 py-2 text-right font-medium">7d</th>
                <th className="px-5 py-2 text-right font-medium">30d</th>
                <th className="px-5 py-2 text-right font-medium">Gesamt</th>
                <th className="px-5 py-2 font-medium">Zuletzt</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr
                  key={s.bot_name}
                  className="border-b border-[color:var(--border)] last:border-b-0"
                >
                  <td className="px-5 py-2">
                    <div className="font-medium">{botLabel(s.bot_name)}</div>
                    <div className="text-xs text-[color:var(--foreground-muted)]">
                      {s.bot_name}
                    </div>
                  </td>
                  <td className="px-5 py-2 text-right font-mono">
                    {s.visits_24h.toLocaleString("de-DE")}
                  </td>
                  <td className="px-5 py-2 text-right font-mono">
                    {s.visits_7d.toLocaleString("de-DE")}
                  </td>
                  <td className="px-5 py-2 text-right font-mono">
                    {s.visits_30d.toLocaleString("de-DE")}
                  </td>
                  <td className="px-5 py-2 text-right font-mono">
                    {s.total.toLocaleString("de-DE")}
                  </td>
                  <td className="px-5 py-2 text-xs text-[color:var(--foreground-muted)]">
                    {formatTimestamp(s.last_seen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="surface-card overflow-hidden p-0">
        <div className="border-b border-[color:var(--border)] p-5">
          <h2 className="eyebrow">Top-Pfade (letzte 7 Tage)</h2>
        </div>
        {topPaths.length === 0 ? (
          <p className="p-5 text-sm text-[color:var(--foreground-muted)]">
            Noch keine Daten.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-left text-xs uppercase tracking-wider text-[color:var(--foreground-muted)]">
                <th className="px-5 py-2 font-medium">Pfad</th>
                <th className="px-5 py-2 text-right font-medium">Visits</th>
              </tr>
            </thead>
            <tbody>
              {topPaths.map((p) => (
                <tr
                  key={p.path}
                  className="border-b border-[color:var(--border)] last:border-b-0"
                >
                  <td className="px-5 py-2 font-mono text-xs">{p.path}</td>
                  <td className="px-5 py-2 text-right font-mono">
                    {p.visits.toLocaleString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="surface-card overflow-hidden p-0">
        <div className="border-b border-[color:var(--border)] p-5">
          <h2 className="eyebrow">Letzte 100 Besuche</h2>
        </div>
        {recent.length === 0 ? (
          <p className="p-5 text-sm text-[color:var(--foreground-muted)]">
            Noch keine Bot-Besuche erfasst.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[color:var(--surface)]">
                <tr className="border-b border-[color:var(--border)] text-left uppercase tracking-wider text-[color:var(--foreground-muted)]">
                  <th className="px-5 py-2 font-medium">Zeit</th>
                  <th className="px-5 py-2 font-medium">Bot</th>
                  <th className="px-5 py-2 font-medium">Pfad</th>
                  <th className="px-5 py-2 font-medium">User-Agent</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-[color:var(--border)] last:border-b-0"
                  >
                    <td className="whitespace-nowrap px-5 py-1.5 font-mono text-[color:var(--foreground-muted)]">
                      {formatTimestamp(v.created_at)}
                    </td>
                    <td className="px-5 py-1.5 font-medium">
                      {botLabel(v.bot_name)}
                    </td>
                    <td className="px-5 py-1.5 font-mono">{v.path}</td>
                    <td className="px-5 py-1.5 font-mono text-[color:var(--foreground-muted)]">
                      {v.user_agent.length > 80
                        ? v.user_agent.slice(0, 80) + "…"
                        : v.user_agent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
