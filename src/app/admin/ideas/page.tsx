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

function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "queued":
      return {
        label: "Warteschlange",
        className: "bg-neutral-100 text-neutral-700",
      };
    case "running":
      return {
        label: "Läuft",
        className: "bg-amber-100 text-amber-800",
      };
    case "done":
      return {
        label: "Fertig",
        className: "bg-emerald-100 text-emerald-800",
      };
    case "failed":
      return {
        label: "Fehler",
        className: "bg-rose-100 text-rose-800",
      };
    default:
      return { label: status, className: "bg-neutral-100 text-neutral-700" };
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ideen-Datenbank</h1>
          <p className="text-sm text-neutral-600">
            {total} Eintrag{total === 1 ? "" : "e"} insgesamt
          </p>
        </div>
      </div>

      <form
        method="GET"
        className="grid grid-cols-1 gap-3 rounded border border-neutral-200 bg-white p-4 sm:grid-cols-[1fr_auto_auto_auto]"
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Suche in Originaltext, Analyse oder Notizen…"
          className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
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
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Anwenden
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">
          Keine Ideen gefunden mit diesen Filtern.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Originaltext</th>
                <th className="px-3 py-2">Tags / Notiz</th>
                <th className="px-3 py-2 whitespace-nowrap">Erstellt</th>
                <th className="px-3 py-2 whitespace-nowrap">Aktualisiert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((row) => (
                <IdeaRowItem key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-600">
            Seite {page} von {totalPages}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link
                href={pageHref({ status, q, sort: sort ?? "created_desc", page: page - 1 })}
                className="rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-100"
              >
                ← Zurück
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref({ status, q, sort: sort ?? "created_desc", page: page + 1 })}
                className="rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-100"
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
    <tr className="hover:bg-neutral-50">
      <td className="whitespace-nowrap px-3 py-2 align-top">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </td>
      <td className="px-3 py-2 align-top">
        <Link
          href={`/admin/ideas/${row.id}`}
          className="block max-w-xl text-neutral-900 hover:underline"
        >
          <span className="line-clamp-2 whitespace-pre-wrap">
            {row.raw_text_preview}
          </span>
        </Link>
        {row.analysis_error && (
          <p className="mt-1 text-xs text-rose-700">
            Fehler: {row.analysis_error.slice(0, 140)}
          </p>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        {row.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {row.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-800"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {row.admin_note && (
          <p className="mt-1 line-clamp-2 max-w-xs text-xs text-neutral-600">
            {row.admin_note}
          </p>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-neutral-600">
        {formatTimestamp(row.created_at)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-neutral-600">
        {formatTimestamp(row.updated_at)}
      </td>
    </tr>
  );
}
