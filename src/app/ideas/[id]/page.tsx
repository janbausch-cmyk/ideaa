import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import BrandWordmark from "@/components/BrandWordmark";
import CopyLinkButton from "@/components/CopyLinkButton";
import FavoriteButton from "@/components/FavoriteButton";
import IdeaStatusPoll from "@/components/IdeaStatusPoll";
import LegalFooter from "@/components/LegalFooter";
import PrintButton from "@/components/PrintButton";
import RecordHistoryEntry from "@/components/RecordHistoryEntry";
import { getIdea } from "@/lib/db";

export const dynamic = "force-dynamic";

// Private Nutzerinhalte (Idee + Bericht): aus Suchmaschinen heraushalten,
// damit Berichte nicht über die Google-Suche auffindbar/abgreifbar sind.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Patterns tried in order. First match wins. Tolerates ## / ### prefixes,
// `7.` and `7)` separators, plus a heading-text fallback for the case where
// the LLM drops the number entirely.
const PLAN_HEADING_PATTERNS: RegExp[] = [
  /(^|\n)#{1,3}\s*7[.)]\s/,
  /(^|\n)\*\*\s*7\s*\.\s/,
  // Multilingual heading-text fallback. Order: EN, DE, NL, ES, FR.
  /(^|\n)#{1,3}\s*(?:Build feasibility|Umsetzbarkeit|Haalbaarheid|Factibilidad|Faisabilité|Implementation plan|Umsetzungsplan)/i,
];

function splitReportAndPlan(markdown: string): {
  report: string;
  plan: string | null;
} {
  for (const re of PLAN_HEADING_PATTERNS) {
    const match = re.exec(markdown);
    if (!match || match.index === undefined) continue;
    const splitAt = match.index + (match[1] === "\n" ? 1 : 0);
    const report = markdown.slice(0, splitAt).trim();
    const plan = markdown.slice(splitAt).trim();
    if (plan.length > 0) return { report, plan };
  }
  return { report: markdown.trim(), plan: null };
}

type StatusInfo = {
  label: string;
  description: string;
  tone: "processing" | "ready" | "failed";
};

function describeStatus(status: string): StatusInfo {
  switch (status) {
    case "ready":
    case "done":
      return {
        label: "Fertig",
        description: "Dein Bericht steht unten.",
        tone: "ready",
      };
    case "failed":
    case "error":
      return {
        label: "Fehlgeschlagen",
        description:
          "Bei der Analyse ist etwas schiefgelaufen. Reiche die Idee bitte noch einmal ein.",
        tone: "failed",
      };
    case "queued":
      return {
        label: "In Warteschlange",
        description:
          "Deine Idee wartet auf den nächsten freien Worker. Die Seite aktualisiert sich automatisch.",
        tone: "processing",
      };
    case "running":
    case "processing":
    default:
      return {
        label: "Wird analysiert",
        description:
          "Wir analysieren deine Idee. Die Seite aktualisiert sich automatisch, meist in unter 60 Sekunden.",
        tone: "processing",
      };
  }
}

export default async function IdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idea = await getIdea(id);
  if (!idea) {
    notFound();
  }
  const status = describeStatus(idea.status);
  const submittedAtDate = new Date(idea.created_at);
  const submittedAt = submittedAtDate.toLocaleString("de-DE");
  const submittedAtIso = submittedAtDate.toISOString();
  const isProcessing = status.tone === "processing";
  const isReady = status.tone === "ready";

  return (
    <main className="app-backdrop flex min-h-screen flex-col items-center px-6 py-12 sm:py-16 print:bg-white print:py-0">
      {isProcessing ? (
        <IdeaStatusPoll id={idea.id} initialStatus={idea.status} />
      ) : null}
      <RecordHistoryEntry
        id={idea.id}
        rawText={idea.raw_text}
        submittedAt={submittedAtIso}
      />
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <Link
          href="/geschaeftsidee-validieren"
          aria-label="IDEAA, zur Startseite"
          className="no-print"
        >
          <BrandWordmark
            className="brand-peak h-8 w-auto transition hover:opacity-80 sm:h-10"
            title="IDEAA"
          />
        </Link>
        <header className="flex flex-col gap-2">
          <Link
            href="/"
            className="no-print inline-flex w-fit items-center gap-1 text-sm font-medium text-[color:var(--foreground-muted)] transition hover:text-[color:var(--brand-ink)]"
          >
            <span aria-hidden>←</span> Neue Idee
          </Link>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-4xl">
              Idee
            </h1>
            <code className="rounded-md bg-[color:var(--surface-muted)] px-2 py-0.5 font-mono text-xs text-[color:var(--foreground-muted)]">
              #{idea.id.slice(0, 8)}
            </code>
          </div>
          <p className="text-xs text-[color:var(--foreground-muted)]">
            Eingereicht am {submittedAt}
          </p>
        </header>

        <div className="no-print flex flex-wrap items-center gap-2">
          <CopyLinkButton />
          <FavoriteButton id={idea.id} />
          {isReady ? <PrintButton /> : null}
        </div>

        <section
          className={
            "surface-card flex flex-col gap-2 p-5 " +
            (status.tone === "ready"
              ? "ring-1 ring-emerald-300/60 dark:ring-emerald-800/50"
              : status.tone === "failed"
                ? "ring-1 ring-rose-300/60 dark:ring-rose-800/50"
                : "ring-1 ring-amber-300/60 dark:ring-amber-800/50")
          }
        >
          <div className="flex items-center gap-2">
            <span
              className={
                "inline-flex h-2.5 w-2.5 rounded-full " +
                (status.tone === "ready"
                  ? "bg-emerald-500"
                  : status.tone === "failed"
                    ? "bg-rose-500"
                    : "animate-pulse bg-amber-500")
              }
            />
            <h2 className="eyebrow !text-[color:var(--foreground)]">
              Status: {status.label}
            </h2>
          </div>
          <p className="text-sm text-[color:var(--foreground)]">
            {status.description}
          </p>
          {status.tone === "failed" && idea.analysis_error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 font-mono text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {idea.analysis_error}
            </p>
          ) : null}
          <p className="text-xs text-[color:var(--foreground-muted)]">
            Speicher die URL als Lesezeichen oder gib sie weiter. Sie zeigt
            immer den aktuellen Stand.
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="eyebrow">Deine Idee</h2>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[color:var(--foreground)]">
            {idea.raw_text}
          </pre>
        </section>

        {status.tone === "ready" && idea.analysis_report
          ? (() => {
              const { report, plan } = splitReportAndPlan(idea.analysis_report);
              return (
                <>
                  <section className="surface-card flex flex-col gap-3 p-6 sm:p-7">
                    <h2 className="eyebrow">Validierungsbericht</h2>
                    <article className="analysis-report">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {report}
                      </ReactMarkdown>
                    </article>
                  </section>
                  {plan ? (
                    <section className="surface-card flex flex-col gap-3 p-6 sm:p-7">
                      <h2 className="eyebrow">Umsetzungsplan</h2>
                      <article className="analysis-report">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {plan}
                        </ReactMarkdown>
                      </article>
                    </section>
                  ) : null}
                </>
              );
            })()
          : null}

        <div className="no-print pt-2">
          <LegalFooter />
        </div>
      </div>
    </main>
  );
}
