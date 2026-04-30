import Link from "next/link";
import { notFound } from "next/navigation";

import { getIdea } from "@/lib/db";

export const dynamic = "force-dynamic";

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
    case "processing":
    default:
      return {
        label: "Processing",
        description:
          "We're analysing your idea. This page will update once the report is ready — keep this URL to check back later.",
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
  const submittedAt = new Date(idea.created_at).toLocaleString();

  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
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
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
              Status: {status.label}
            </h2>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            {status.description}
          </p>
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
      </div>
    </main>
  );
}
