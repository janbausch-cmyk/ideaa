import { isAdminRequestAuthorized } from "@/lib/admin-auth";
import { adminIdeasForExportPaged, type IdeaRow } from "@/lib/db";

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

function parseSince(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return undefined;
  return new Date(t);
}

export async function GET(request: Request) {
  if (!(await isAdminRequestAuthorized(request))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");
  const since = parseSince(url.searchParams.get("since"));

  const { rows, total, has_more } = await adminIdeasForExportPaged({
    limit: limit ? Number.parseInt(limit, 10) : undefined,
    offset: offset ? Number.parseInt(offset, 10) : undefined,
    since,
  });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  if (format === "csv") {
    const body = toCsv(rows);
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ideaa-ideas-${stamp}.csv"`,
        "Cache-Control": "no-store",
        "X-Total-Count": String(total),
        "X-Has-More": String(has_more),
      },
    });
  }

  return new Response(
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        total,
        count: rows.length,
        has_more,
        ideas: rows,
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ideaa-ideas-${stamp}.json"`,
        "Cache-Control": "no-store",
        "X-Total-Count": String(total),
        "X-Has-More": String(has_more),
      },
    },
  );
}
