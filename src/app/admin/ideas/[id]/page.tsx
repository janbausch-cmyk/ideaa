import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getIdea, isValidIdeaId } from "@/lib/db";

import DeleteIdeaButton from "./DeleteIdeaButton";
import DeepdiveRefresh from "./DeepdiveRefresh";
import {
  deepdiveAction,
  reanalyzeAction,
  setNoteAction,
  setStatusAction,
} from "./actions";

export const dynamic = "force-dynamic";
// Server Actions on this page (esp. `deepdiveAction`) kick off LLM work via
// `after()`. That callback runs inside the Server Action's function lifetime
// (bound by maxDuration). Without this, Vercel kills the function at the
// default ~60s, leaving rows stuck in `deepdive_status = 'running'`.
export const maxDuration = 300;

const STATUS_LABELS: Record<string, string> = {
  queued: "In Warteschlange",
  running: "Läuft",
  done: "Fertig",
  failed: "Fehlgeschlagen",
};

const ALL_STATUSES = ["queued", "running", "done", "failed"] as const;

const FLASH_MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  status: { tone: "ok", text: "Status aktualisiert." },
  note: { tone: "ok", text: "Notiz / Tags gespeichert." },
  reanalyze: {
    tone: "ok",
    text:
      "Re-Analyse wurde gestartet. Aktualisiere die Seite in einigen Sekunden, um Fortschritt zu sehen.",
  },
  invalid_status: { tone: "error", text: "Ungültiger Status." },
  deepdive_started: {
    tone: "ok",
    text:
      "Ausarbeitung wurde gestartet. Die Seite aktualisiert sich automatisch, sobald das Dokument fertig ist (~30–60s).",
  },
};

const DEEPDIVE_STATUS_LABELS: Record<string, string> = {
  idle: "Noch nicht ausgearbeitet",
  queued: "In Warteschlange",
  running: "Wird ausgearbeitet…",
  done: "Fertig",
  failed: "Fehlgeschlagen",
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

export default async function AdminIdeaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
  const { id } = await params;
  if (!isValidIdeaId(id)) notFound();
  const idea = await getIdea(id);
  if (!idea) notFound();

  const sp = await searchParams;
  const okKey = (sp.ok as string | undefined) ?? null;
  const errorKey = (sp.error as string | undefined) ?? null;
  const flash = okKey
    ? FLASH_MESSAGES[okKey]
    : errorKey
      ? FLASH_MESSAGES[errorKey]
      : null;

  const statusTone =
    idea.status === "done"
      ? "bg-emerald-500"
      : idea.status === "running"
        ? "bg-amber-500 animate-pulse"
        : idea.status === "failed"
          ? "bg-rose-500"
          : "bg-zinc-400 dark:bg-zinc-500";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin/ideas"
            className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--foreground-muted)] transition hover:text-[color:var(--brand-ink)]"
          >
            <span aria-hidden>←</span> Zurück zur Liste
          </Link>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Idee</h1>
            <code className="rounded-md bg-[color:var(--surface-muted)] px-2 py-0.5 font-mono text-xs text-[color:var(--foreground-muted)]">
              #{idea.id.slice(0, 8)}
            </code>
          </div>
          <p className="mt-1 inline-flex items-center gap-2 text-sm text-[color:var(--foreground-muted)]">
            <span className={"h-2 w-2 rounded-full " + statusTone} aria-hidden />
            <span>
              <strong className="font-semibold text-[color:var(--foreground)]">
                {STATUS_LABELS[idea.status] ?? idea.status}
              </strong>{" "}
              · Erstellt {formatTimestamp(idea.created_at)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/ideas/${idea.id}`}
            className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-1.5 text-sm font-medium shadow-sm transition hover:border-[color:var(--brand-ink)]/40 hover:text-[color:var(--brand-ink)]"
          >
            Öffentliche Ansicht ↗
          </Link>
          {idea.analysis_report ? (
            <a
              href={`/admin/ideas/${idea.id}/print/report`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-1.5 text-sm font-medium shadow-sm transition hover:border-[color:var(--brand-ink)]/40 hover:text-[color:var(--brand-ink)]"
            >
              Bericht als PDF ↗
            </a>
          ) : null}
          {idea.deepdive_report ? (
            <a
              href={`/admin/ideas/${idea.id}/print/deepdive`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-1.5 text-sm font-medium shadow-sm transition hover:border-[color:var(--brand-ink)]/40 hover:text-[color:var(--brand-ink)]"
            >
              Ausarbeitung als PDF ↗
            </a>
          ) : null}
          <a
            href={`/api/admin/analyze/${idea.id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-1.5 text-sm font-medium shadow-sm transition hover:border-[color:var(--brand-ink)]/40 hover:text-[color:var(--brand-ink)]"
          >
            Trace JSON ↗
          </a>
        </div>
      </div>

      {flash && (
        <div
          className={
            "rounded-xl border p-3 text-sm " +
            (flash.tone === "ok"
              ? "border-emerald-300/70 bg-emerald-50 text-emerald-900 dark:border-emerald-700/40 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-rose-300/70 bg-rose-50 text-rose-900 dark:border-rose-700/40 dark:bg-rose-950/40 dark:text-rose-200")
          }
        >
          {flash.text}
        </div>
      )}

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="surface-card p-5 lg:col-span-2">
          <h2 className="eyebrow">Originaltext</h2>
          <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[color:var(--foreground)]">
            {idea.raw_text}
          </pre>
        </div>
        <div className="surface-card p-5">
          <h2 className="eyebrow">Metadaten</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Meta label="ID" value={<code className="text-xs">{idea.id}</code>} />
            <Meta
              label="Status"
              value={STATUS_LABELS[idea.status] ?? idea.status}
            />
            <Meta label="Erstellt" value={formatTimestamp(idea.created_at)} />
            <Meta
              label="Aktualisiert"
              value={formatTimestamp(idea.updated_at)}
            />
            <Meta
              label="Analyse gestartet"
              value={formatTimestamp(idea.analysis_started_at)}
            />
            <Meta
              label="Analyse beendet"
              value={formatTimestamp(idea.analysis_finished_at)}
            />
            <Meta
              label="Report-Länge"
              value={
                idea.analysis_report
                  ? `${idea.analysis_report.length} Zeichen`
                  : "—"
              }
            />
          </dl>
        </div>
      </section>

      {idea.analysis_error && (
        <section className="surface-card border-rose-300/70 bg-rose-50/70 p-5 dark:border-rose-700/40 dark:bg-rose-950/40">
          <h2 className="eyebrow !text-rose-700 dark:!text-rose-300">
            Fehlermeldung
          </h2>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-rose-900 dark:text-rose-200">
            {idea.analysis_error}
          </pre>
        </section>
      )}

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <form
          action={setNoteAction}
          className="surface-card space-y-3 p-5"
        >
          <h2 className="eyebrow">Notiz & Tags</h2>
          <input type="hidden" name="id" value={idea.id} />
          <label className="block text-sm">
            <span className="font-medium text-[color:var(--foreground)]">
              Notiz
            </span>
            <textarea
              name="note"
              defaultValue={idea.admin_note ?? ""}
              rows={5}
              maxLength={4000}
              className="mt-1 block w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm shadow-inner focus:border-[color:var(--brand-ink)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ink)]/20"
              placeholder="Interne Notiz für das Team…"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[color:var(--foreground)]">
              Tags (durch Komma getrennt)
            </span>
            <input
              type="text"
              name="tags"
              defaultValue={idea.tags.join(", ")}
              className="mt-1 block w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm shadow-inner focus:border-[color:var(--brand-ink)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ink)]/20"
              placeholder="z.B. saas, b2b, follow-up"
            />
          </label>
          <button
            type="submit"
            className="brand-button inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold"
          >
            Speichern
          </button>
        </form>

        <div className="surface-card space-y-3 p-5">
          <h2 className="eyebrow">Aktionen</h2>

          <form
            action={setStatusAction}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="id" value={idea.id} />
            <label className="flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
              Status:
              <select
                name="status"
                defaultValue={idea.status}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-sm focus:border-[color:var(--brand-ink)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ink)]/20"
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-1.5 text-sm font-medium shadow-sm transition hover:border-[color:var(--brand-ink)]/40 hover:text-[color:var(--brand-ink)]"
            >
              Anwenden
            </button>
          </form>

          <form action={reanalyzeAction}>
            <input type="hidden" name="id" value={idea.id} />
            <button
              type="submit"
              className="w-full rounded-xl border border-indigo-300/70 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 transition hover:bg-indigo-100 dark:border-indigo-700/40 dark:bg-indigo-950/40 dark:text-indigo-200"
            >
              Re-Analyse starten (Report wird verworfen)
            </button>
          </form>

          <DeleteIdeaButton id={idea.id} />
        </div>
      </section>

      {idea.analysis_report && (
        <section className="surface-card p-5">
          <h2 className="eyebrow">Analyse-Output (Markdown)</h2>
          <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[color:var(--surface-muted)] p-4 font-mono text-xs text-[color:var(--foreground)]">
            {idea.analysis_report}
          </pre>
        </section>
      )}

      {idea.analysis_tool_trace && idea.analysis_tool_trace.length > 0 && (
        <section className="surface-card p-5">
          <h2 className="eyebrow">
            Tool-Trace ({idea.analysis_tool_trace.length} Einträge)
          </h2>
          <pre className="mt-3 max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[color:var(--surface-muted)] p-4 font-mono text-xs text-[color:var(--foreground)]">
            {JSON.stringify(idea.analysis_tool_trace, null, 2)}
          </pre>
        </section>
      )}

      <DeepdiveSection idea={idea} />
    </div>
  );
}

const DEEPDIVE_STUCK_AFTER_MS = 5 * 60 * 1000;

function DeepdiveSection({ idea }: { idea: Awaited<ReturnType<typeof getIdea>> }) {
  if (!idea) return null;
  const ddStatus = idea.deepdive_status ?? "idle";
  const isRunning = ddStatus === "queued" || ddStatus === "running";
  const runningSinceMs = idea.deepdive_started_at
    ? Date.now() - new Date(idea.deepdive_started_at).getTime()
    : 0;
  const isStuck = isRunning && runningSinceMs > DEEPDIVE_STUCK_AFTER_MS;
  const hasReport = !!idea.deepdive_report;
  const buttonLabel = isStuck
    ? "Neu starten (vorherige Generierung hängt)"
    : hasReport
      ? "Neu ausarbeiten (überschreibt)"
      : "Idee ausarbeiten";
  const buttonDisabled = isRunning && !isStuck;
  const totalTokens =
    (idea.deepdive_input_tokens ?? 0) + (idea.deepdive_output_tokens ?? 0);

  return (
    <section className="surface-card space-y-4 p-5">
      <DeepdiveRefresh active={isRunning} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="eyebrow">Ausarbeitung</h2>
          <p className="mt-1 text-sm text-[color:var(--foreground-muted)]">
            Tieferer Pass über die Validierung hinaus: Zielkunde, Wettbewerb,
            MVP-Skizze, GTM-Wedge, 30/60/90-Plan, Risiken.
          </p>
          <p className="mt-2 inline-flex items-center gap-2 text-xs text-[color:var(--foreground-muted)]">
            <span
              className={
                "h-2 w-2 rounded-full " +
                (ddStatus === "done"
                  ? "bg-emerald-500"
                  : ddStatus === "running"
                    ? "bg-amber-500 animate-pulse"
                    : ddStatus === "queued"
                      ? "bg-amber-300 animate-pulse"
                      : ddStatus === "failed"
                        ? "bg-rose-500"
                        : "bg-zinc-400 dark:bg-zinc-500")
              }
              aria-hidden
            />
            <span>
              <strong className="font-semibold text-[color:var(--foreground)]">
                {DEEPDIVE_STATUS_LABELS[ddStatus] ?? ddStatus}
              </strong>
              {idea.deepdive_finished_at ? (
                <>
                  {" "}
                  · zuletzt am {formatTimestamp(idea.deepdive_finished_at)}
                </>
              ) : null}
              {totalTokens > 0 ? (
                <>
                  {" "}
                  · {totalTokens.toLocaleString("de-DE")} Tokens
                  {idea.deepdive_model ? <> ({idea.deepdive_model})</> : null}
                </>
              ) : null}
            </span>
          </p>
        </div>
        <form action={deepdiveAction}>
          <input type="hidden" name="id" value={idea.id} />
          <button
            type="submit"
            disabled={buttonDisabled}
            className="rounded-full bg-[color:var(--brand-ink)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buttonDisabled ? "Wird ausgearbeitet…" : buttonLabel}
          </button>
        </form>
      </div>

      {isStuck ? (
        <div className="rounded-xl border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-700/40 dark:bg-rose-950/40 dark:text-rose-200">
          <strong className="font-semibold">Hängt seit {Math.round(runningSinceMs / 60000)} min.</strong>{" "}
          Wahrscheinlich hat die Vercel-Function das Timeout erreicht, bevor der LLM-Call fertig war.
          Klick auf <em>Neu starten</em>, um einen frischen Versuch anzustoßen — der reclaimt die Row automatisch.
        </div>
      ) : null}

      {idea.deepdive_error ? (
        <div className="rounded-xl border border-rose-300/70 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-700/40 dark:bg-rose-950/40 dark:text-rose-200">
          <strong className="font-semibold">Fehler:</strong>{" "}
          <span className="font-mono text-xs">{idea.deepdive_error}</span>
        </div>
      ) : null}

      {hasReport ? (
        <article className="analysis-report">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {idea.deepdive_report ?? ""}
          </ReactMarkdown>
        </article>
      ) : isRunning && !isStuck ? (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-200">
          Die Ausarbeitung läuft (typisch 30–60s, inkl. Web-Recherche). Diese
          Seite aktualisiert sich automatisch.
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--foreground-muted)]">
          Klick auf <em>Idee ausarbeiten</em>, um den tieferen Pass zu starten.
        </div>
      )}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-b border-[color:var(--border)] pb-1.5 last:border-b-0 last:pb-0">
      <dt className="text-[color:var(--foreground-muted)]">{label}</dt>
      <dd className="text-right font-medium text-[color:var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}

