import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import PrintButton from "@/components/PrintButton";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getIdea, isValidIdeaId } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const TYPE_LABELS = {
  report: "Validierungsbericht",
  deepdive: "Ausarbeitung",
} as const;

type PrintType = keyof typeof TYPE_LABELS;

function isPrintType(value: string): value is PrintType {
  return value === "report" || value === "deepdive";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AdminPrintPage({
  params,
}: {
  params: Promise<{ id: string; type: string }>;
}) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
  const { id, type } = await params;
  if (!isValidIdeaId(id)) notFound();
  if (!isPrintType(type)) notFound();
  const idea = await getIdea(id);
  if (!idea) notFound();

  const content =
    type === "report" ? idea.analysis_report : idea.deepdive_report;
  if (!content) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold">
          {TYPE_LABELS[type]} nicht verfügbar
        </h1>
        <p className="mt-3 text-sm text-[color:var(--foreground-muted)]">
          Für diese Idee gibt es keinen {TYPE_LABELS[type].toLowerCase()}.
          Zurück zur{" "}
          <a
            href={`/admin/ideas/${idea.id}`}
            className="font-medium underline"
          >
            Admin-Ansicht
          </a>
          .
        </p>
      </main>
    );
  }

  const generatedAt =
    type === "report" ? idea.analysis_finished_at : idea.deepdive_finished_at;

  const label = TYPE_LABELS[type];
  const shortId = idea.id.slice(0, 8);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
      <title>{`IDEAA ${label} #${shortId}`}</title>

      <div className="no-print mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4 text-sm">
        <div>
          <p className="font-medium text-[color:var(--foreground)]">
            Druckansicht: {label} #{shortId}
          </p>
          <p className="text-xs text-[color:var(--foreground-muted)]">
            Klick auf <em>Als PDF herunterladen</em> oder drücke
            Cmd/Ctrl+P. Im Druckdialog Ziel auf „Als PDF speichern" stellen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/admin/ideas/${idea.id}`}
            className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium shadow-sm transition hover:border-[color:var(--brand-ink)]/40 hover:text-[color:var(--brand-ink)]"
          >
            ← Zurück
          </a>
          <PrintButton />
        </div>
      </div>

      <header className="mb-8 border-b border-[color:var(--border)] pb-4">
        <p className="text-xs uppercase tracking-wider text-[color:var(--foreground-muted)]">
          IDEAA · {label}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[color:var(--foreground)]">
          Idee #{shortId}
        </h1>
        <p className="mt-1 text-xs text-[color:var(--foreground-muted)]">
          Eingereicht: {formatDate(idea.created_at)}
          {generatedAt ? <> · Bericht: {formatDate(generatedAt)}</> : null}
        </p>
      </header>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--foreground-muted)]">
          Originaltext
        </h2>
        <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[color:var(--foreground)]">
          {idea.raw_text}
        </pre>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--foreground-muted)]">
          {label}
        </h2>
        <article className="analysis-report mt-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </article>
      </section>
    </main>
  );
}
