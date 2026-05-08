import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getIdea, isValidIdeaId } from "@/lib/db";

import DeleteIdeaButton from "./DeleteIdeaButton";
import {
  reanalyzeAction,
  setNoteAction,
  setStatusAction,
} from "./actions";

export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link
            href="/admin/ideas"
            className="text-sm text-neutral-500 hover:text-neutral-800"
          >
            ← Zurück zur Liste
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Idee #{idea.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-neutral-600">
            Status:{" "}
            <strong>{STATUS_LABELS[idea.status] ?? idea.status}</strong> ·
            Erstellt {formatTimestamp(idea.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/ideas/${idea.id}`}
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Öffentliche Ansicht ↗
          </Link>
          <a
            href={`/api/admin/analyze/${idea.id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Trace JSON ↗
          </a>
        </div>
      </div>

      {flash && (
        <div
          className={
            "rounded border p-3 text-sm " +
            (flash.tone === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-rose-300 bg-rose-50 text-rose-900")
          }
        >
          {flash.text}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded border border-neutral-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Originaltext
          </h2>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm text-neutral-900">
            {idea.raw_text}
          </pre>
        </div>
        <div className="space-y-3 rounded border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Metadaten
          </h2>
          <dl className="space-y-1 text-sm">
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
        <section className="rounded border border-rose-300 bg-rose-50 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-700">
            Fehlermeldung
          </h2>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-rose-900">
            {idea.analysis_error}
          </pre>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form
          action={setNoteAction}
          className="space-y-3 rounded border border-neutral-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Notiz & Tags
          </h2>
          <input type="hidden" name="id" value={idea.id} />
          <label className="block text-sm">
            <span className="text-neutral-700">Notiz</span>
            <textarea
              name="note"
              defaultValue={idea.admin_note ?? ""}
              rows={5}
              maxLength={4000}
              className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:outline-none"
              placeholder="Interne Notiz für das Team…"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-700">
              Tags (durch Komma getrennt)
            </span>
            <input
              type="text"
              name="tags"
              defaultValue={idea.tags.join(", ")}
              className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-500 focus:outline-none"
              placeholder="z.B. saas, b2b, follow-up"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Speichern
          </button>
        </form>

        <div className="space-y-3 rounded border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Aktionen
          </h2>

          <form action={setStatusAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={idea.id} />
            <label className="text-sm text-neutral-700">
              Status setzen:
              <select
                name="status"
                defaultValue={idea.status}
                className="ml-2 rounded border border-neutral-300 px-2 py-1 text-sm"
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
              className="rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-100"
            >
              Status anwenden
            </button>
          </form>

          <form action={reanalyzeAction}>
            <input type="hidden" name="id" value={idea.id} />
            <button
              type="submit"
              className="w-full rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 hover:bg-sky-100"
            >
              Re-Analyse starten (Report wird verworfen)
            </button>
          </form>

          <DeleteIdeaButton id={idea.id} />
        </div>
      </section>

      {idea.analysis_report && (
        <section className="rounded border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Analyse-Output (Markdown)
          </h2>
          <pre className="mt-2 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded bg-neutral-50 p-3 font-mono text-xs text-neutral-800">
            {idea.analysis_report}
          </pre>
        </section>
      )}

      {idea.analysis_tool_trace && idea.analysis_tool_trace.length > 0 && (
        <section className="rounded border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Tool-Trace ({idea.analysis_tool_trace.length} Einträge)
          </h2>
          <pre className="mt-2 max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded bg-neutral-50 p-3 font-mono text-xs text-neutral-800">
            {JSON.stringify(idea.analysis_tool_trace, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-900">{value}</dd>
    </div>
  );
}

