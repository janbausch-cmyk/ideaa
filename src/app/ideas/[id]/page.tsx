import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import CopyLinkButton from "@/components/CopyLinkButton";
import FavoriteButton from "@/components/FavoriteButton";
import PrintButton from "@/components/PrintButton";
import RecordHistoryEntry from "@/components/RecordHistoryEntry";
import { getIdea } from "@/lib/db";

export const dynamic = "force-dynamic";

const PLAN_HEADING_RE = /(^|\n)##\s*7\.\s/;

function splitReportAndPlan(markdown: string): {
  report: string;
  plan: string | null;
} {
  const match = PLAN_HEADING_RE.exec(markdown);
  if (!match || match.index === undefined) {
    return { report: markdown.trim(), plan: null };
  }
  const splitAt = match.index + (match[1] === "\n" ? 1 : 0);
  const report = markdown.slice(0, splitAt).trim();
  const plan = markdown.slice(splitAt).trim();
  return { report, plan: plan || null };
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
        label: "Ready",
        description: "Your validation report is ready below.",
        tone: "ready",
      };
    case "failed":
    case "error":
      return {
        label: "Failed",
        description:
          "Something went wrong while analysing this idea. Try resubmitting from the home page.",
        tone: "failed",
      };
    case "queued":
      return {
        label: "Queued",
        description:
          "Your idea is queued and will be picked up by a worker shortly. This page refreshes automatically.",
        tone: "processing",
      };
    case "running":
    case "processing":
    default:
      return {
        label: "Analyzing",
        description:
          "We're analysing your idea. This page refreshes automatically when the report is ready — usually under 60 seconds.",
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
  const submittedAt = submittedAtDate.toLocaleString();
  const submittedAtIso = submittedAtDate.toISOString();
  const isProcessing = status.tone === "processing";
  const isReady = status.tone === "ready";

  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black print:bg-white print:py-0">
      {isProcessing ? (
        <meta httpEquiv="refresh" content="5" />
      ) : null}
      <RecordHistoryEntry
        id={idea.id}
        rawText={idea.raw_text}
        submittedAt={submittedAtIso}
      />
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <Link
            href="/"
            className="no-print text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← New idea
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Idea #{idea.id.slice(0, 8)}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Submitted {submittedAt}
          </p>
        </header>

        <div className="no-print flex flex-wrap items-center gap-2">
          <CopyLinkButton />
          <FavoriteButton id={idea.id} />
          {isReady ? <PrintButton /> : null}
        </div>

        <section
          className={
            "flex flex-col gap-2 rounded-lg border p-4 " +
            (status.tone === "ready"
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950"
              : status.tone === "failed"
                ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950"
                : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950")
          }
        >
          <div className="flex items-center gap-2">
            <span
              className={
                "inline-flex h-2 w-2 rounded-full " +
                (status.tone === "ready"
                  ? "bg-emerald-500"
                  : status.tone === "failed"
                    ? "bg-red-500"
                    : "animate-pulse bg-amber-500")
              }
            />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
              Status: {status.label}
            </h2>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            {status.description}
          </p>
          {status.tone === "failed" && idea.analysis_error ? (
            <p className="text-xs text-red-700 dark:text-red-300">
              {idea.analysis_error}
            </p>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Bookmark or share this URL — it always shows the latest state for
            this idea.
          </p>
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Your idea
          </h2>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-zinc-800 dark:text-zinc-100">
            {idea.raw_text}
          </pre>
        </section>

        {status.tone === "ready" && idea.analysis_report
          ? (() => {
              const { report, plan } = splitReportAndPlan(idea.analysis_report);
              return (
                <>
                  <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Validation report
                    </h2>
                    <article className="analysis-report text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {report}
                      </ReactMarkdown>
                    </article>
                  </section>
                  {plan ? (
                    <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Implementation plan
                      </h2>
                      <article className="analysis-report text-sm">
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
      </div>
    </main>
  );
}
