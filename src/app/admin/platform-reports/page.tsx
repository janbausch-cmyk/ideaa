import Link from "next/link";
import { redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listRecentWeeklyPlatformReports } from "@/lib/db";

import { generateReportAction } from "./actions";

export const dynamic = "force-dynamic";

function formatWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const FLASH: Record<string, { tone: "ok" | "error"; text: string }> = {
  started: {
    tone: "ok",
    text:
      "Bericht wird generiert (~30–60s). Aktualisiere die Seite gleich, der neue Eintrag erscheint dann oben.",
  },
};

export default async function PlatformReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
  const params = await searchParams;
  const okKey = (params.ok as string | undefined) ?? "";
  const flash = FLASH[okKey];

  const reports = await listRecentWeeklyPlatformReports(5);
  const latest = reports[0] ?? null;
  const previous = reports.slice(1, 5);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Plattform-Positionierung
          </h1>
          <p className="mt-1 text-sm text-[color:var(--foreground-muted)]">
            Wöchentlicher Bericht: Wettbewerb, SEO, Content-Trends,
            Handlungsempfehlungen.
          </p>
        </div>
        <form action={generateReportAction}>
          <button
            type="submit"
            className="rounded-full bg-[color:var(--brand-ink)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            Jetzt neuen Bericht erzeugen
          </button>
        </form>
      </header>

      {flash ? (
        <div
          className={
            flash.tone === "ok"
              ? "rounded-xl border border-emerald-300/70 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "rounded-xl border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-700/40 dark:bg-rose-950/40 dark:text-rose-200"
          }
        >
          {flash.text}
        </div>
      ) : null}

      {latest ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Aktueller Bericht — Woche ab {formatWeek(latest.week_start_at)}
            </h2>
            <div className="text-xs text-[color:var(--foreground-muted)]">
              Erstellt {formatTimestamp(latest.created_at)}
              {latest.model ? ` · ${latest.model}` : ""}
              {latest.input_tokens && latest.output_tokens
                ? ` · ${latest.input_tokens} in / ${latest.output_tokens} out tokens`
                : ""}
            </div>
          </div>
          <article className="analysis-report rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {latest.body}
            </ReactMarkdown>
          </article>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] p-8 text-center text-sm text-[color:var(--foreground-muted)]">
          Noch kein Bericht vorhanden. Klick &bdquo;Jetzt neuen Bericht
          erzeugen&ldquo; oben rechts, um den ersten Bericht zu generieren.
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Letzte 4 Wochen</h3>
        {previous.length === 0 ? (
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Noch keine älteren Berichte.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--border)] rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]">
            {previous.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/platform-reports/${r.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-[color:var(--surface-muted)]"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">
                      Woche ab {formatWeek(r.week_start_at)}
                    </span>
                    <span className="text-xs text-[color:var(--foreground-muted)]">
                      Erstellt {formatTimestamp(r.created_at)}
                    </span>
                  </span>
                  <span className="text-xs text-[color:var(--foreground-muted)]">
                    {r.body.length.toLocaleString("de-DE")} Zeichen →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
