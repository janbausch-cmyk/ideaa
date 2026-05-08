import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { adminAllIdeasForExport, type IdeaRow } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CSV_COLUMNS = [
  "id",
  "status",
  "created_at",
  "updated_at",
  "analysis_started_at",
  "analysis_finished_at",
  "tags",
  "admin_note",
  "analysis_error",
  "raw_text",
  "analysis_report",
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (Array.isArray(value)) {
    s = value.join(", ");
  } else if (typeof value === "object") {
    s = JSON.stringify(value);
  } else {
    s = String(value);
  }
  // Strip CR to keep CSV well-formed; quote always to be safe.
  s = s.replace(/\r/g, "");
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(rows: IdeaRow[]): string {
  const header = CSV_COLUMNS.join(",");
  const lines = rows.map((r) =>
    CSV_COLUMNS.map((col) =>
      csvCell((r as unknown as Record<string, unknown>)[col]),
    ).join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

export async function GET(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const rows = await adminAllIdeasForExport();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (format === "csv") {
    const body = toCsv(rows);
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ideaa-ideas-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(JSON.stringify({ exported_at: new Date().toISOString(), count: rows.length, ideas: rows }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ideaa-ideas-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
