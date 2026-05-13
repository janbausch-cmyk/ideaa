import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getWeeklyPlatformReport } from "@/lib/db";

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

export default async function PlatformReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
  const { id } = await params;
  const report = await getWeeklyPlatformReport(id);
  if (!report) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link
            href="/admin/platform-reports"
            className="text-xs text-[color:var(--foreground-muted)] transition hover:text-[color:var(--brand-ink)]"
          >
            ← Übersicht
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Bericht — Woche ab {formatWeek(report.week_start_at)}
          </h1>
        </div>
        <div className="text-xs text-[color:var(--foreground-muted)]">
          Erstellt {formatTimestamp(report.created_at)}
          {report.model ? ` · ${report.model}` : ""}
          {report.input_tokens && report.output_tokens
            ? ` · ${report.input_tokens} in / ${report.output_tokens} out tokens`
            : ""}
        </div>
      </div>
      <article className="analysis-report rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.body}</ReactMarkdown>
      </article>
    </div>
  );
}
