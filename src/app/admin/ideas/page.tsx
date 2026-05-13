import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  adminListIdeas,
  type AdminIdeaListRow,
  type AdminListFilter,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Alle" },
  { value: "queued", label: "In Warteschlange" },
  { value: "running", label: "Läuft" },
  { value: "done", label: "Fertig" },
  { value: "failed", label: "Fehlgeschlagen" },
];

const SORT_OPTIONS: Array<{ value: NonNullable<AdminListFilter["sort"]>; label: string }> = [
  { value: "created_desc", label: "Neueste zuerst" },
  { value: "created_asc", label: "Älteste zuerst" },
  { value: "updated_desc", label: "Zuletzt aktualisiert" },
  { value: "status", label: "Nach Status" },
];

const PAGE_SIZE = 50;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function statusBadge(status: string): {
  label: string;
  className: string;
  dot: string;
} {
  switch (status) {
    case "queued":
      return {
        label: "Warteschlange",
        className:
          "bg-[color:var(--surface-muted)] text-[color:var(--foreground-muted)] ring-1 ring-[color:var(--border)]",
        dot: "bg-zinc-400 dark:bg-zinc-500",
      };
    case "running":
      return {
        label: "Läuft",
        className:
          "bg-amber-100 text-amber-800 ring-1 ring-amber-200/70 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-700/40",
        dot: "bg-amber-500 animate-pulse",
      };
    case "done":
      return {
        label: "Fertig",
        className:
          "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/70 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-700/40",
        dot: "bg-emerald-500",
      };
    case "failed":
      return {
        label: "Fehler",
        className:
          "bg-rose-100 text-rose-800 ring-1 ring-rose-200/70 dark:bg-rose-900/30 dark:text-rose-200 dark:ring-rose-700/40",
        dot: "bg-rose-500",
      };
    default:
      return {
        label: status,
        className:
          "bg-[color:var(--surface-muted)] text-[color:var(--foreground-muted)] ring-1 ring-[color:var(--border)]",
        dot: "bg-zinc-400 dark:bg-zinc-500",
      };
  }
}

export default async function AdminIdeasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
  const params = await searchParams;
  const status = (params.status as string | undefined) ?? "";
  const q = (params.q as string | undefined) ?? "";
  const sortRaw = (params.sort as string | undefined) ?? "created_desc";
  const sort = (
    SORT_OPTIONS.find((o) => o.value === sortRaw)?.value ?? "created_desc"
  ) as AdminListFilter["sort"];
  const page = Math.max(parseInt((params.page as string) ?? "1", 10) || 1, 1);

  const { rows, total } = await adminListIdeas({
    status: status || undefined,
    q: q || undefined,
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Admin</span>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Ideen-Datenbank
          </h1>
          <p className="mt-1 text-sm text-[color:var(--foreground-muted)]">
            <span className="font-semibold tabular-nums text-[color:var(--foreground)]">
              {total}
            </span>{" "}
            Eintrag{total === 1 ? "" : "e"} insgesamt
          </p>
        </div>
      </div>

      <form
        method="GET"
        className="surface-card grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:p-5"
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Suche in Originaltext, Analyse oder Notizen…"
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm shadow-inner focus:border-[color:var(--brand-ink)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ink)]/20"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm focus:border-[color:var(--brand-ink)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ink)]/20"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm focus:border-[color:var(--brand-ink)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ink)]/20"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="brand-button rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          Anwenden
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface)] p-10 text-center">
          <p className="text-base font-medium text-[color:var(--foreground)]">
            Keine Ideen gefunden
          </p>
          <p className="mt-1 text-sm text-[color:var(--foreground-muted)]">
            Probier’s mit anderen Filtern oder leere die Suche.
          </p>
        </div>
      ) : (
        <div className="surface-card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface-muted)] text-left text-[11px] font-semibold uppercase tracking-wider text-[color:var(--foreground-muted)]">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Originaltext</th>
                <th className="px-4 py-3">Tags / Notiz</th>
                <th className="whitespace-nowrap px-4 py-3">Erstellt</th>
                <th className="whitespace-nowrap px-4 py-3">Aktualisiert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)]">
              {rows.map((row) => (
                <IdeaRowItem key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[color:var(--foreground-muted)]">
            Seite{" "}
            <span className="font-semibold text-[color:var(--foreground)]">
              {page}
            </span>{" "}
            von {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={pageHref({ status, q, sort: sort ?? "created_desc", page: page - 1 })}
                className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-1.5 font-medium shadow-sm transition hover:border-[color:var(--brand-ink)]/40 hover:text-[color:var(--brand-ink)]"
              >
                ← Zurück
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref({ status, q, sort: sort ?? "created_desc", page: page + 1 })}
                className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-1.5 font-medium shadow-sm transition hover:border-[color:var(--brand-ink)]/40 hover:text-[color:var(--brand-ink)]"
              >
                Weiter →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function pageHref(args: {
  status: string;
  q: string;
  sort: string;
  page: number;
}): string {
  const params = new URLSearchParams();
  if (args.status) params.set("status", args.status);
  if (args.q) params.set("q", args.q);
  if (args.sort && args.sort !== "created_desc") params.set("sort", args.sort);
  if (args.page > 1) params.set("page", String(args.page));
  const qs = params.toString();
  return qs ? `/admin/ideas?${qs}` : "/admin/ideas";
}

function IdeaRowItem({ row }: { row: AdminIdeaListRow }) {
  const badge = statusBadge(row.status);
  return (
    <tr className="transition hover:bg-[color:var(--surface-muted)]/60">
      <td className="whitespace-nowrap px-4 py-3 align-top">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
        >
          <span
            aria-hidden
            className={"h-1.5 w-1.5 rounded-full " + badge.dot}
          />
          {badge.label}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <Link
          href={`/admin/ideas/${row.id}`}
          className="block max-w-xl font-medium text-[color:var(--foreground)] transition hover:text-[color:var(--brand-ink)]"
        >
          <span className="line-clamp-2 whitespace-pre-wrap">
            {row.raw_text_preview}
          </span>
        </Link>
        {row.analysis_error && (
          <p className="mt-1 line-clamp-1 text-xs text-rose-700 dark:text-rose-300">
            Fehler: {row.analysis_error.slice(0, 140)}
          </p>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        {row.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {row.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200/70 dark:bg-indigo-950/40 dark:text-indigo-200 dark:ring-indigo-700/40"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {row.admin_note && (
          <p className="mt-1 line-clamp-2 max-w-xs text-xs text-[color:var(--foreground-muted)]">
            {row.admin_note}
          </p>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-xs tabular-nums text-[color:var(--foreground-muted)]">
        {formatTimestamp(row.created_at)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-xs tabular-nums text-[color:var(--foreground-muted)]">
        {formatTimestamp(row.updated_at)}
      </td>
    </tr>
  );
}
