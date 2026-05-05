// Paperclip API wrapper used by the Telegram bot worker.
// Auth: Bearer token in PAPERCLIP_BOT_API_KEY (a long-lived service key, or
// in dev the same JWT this agent runs under). The bot is not an issue
// executor, so it does not send X-Paperclip-Run-Id headers.

export class PaperclipApiError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: number,
    public readonly bodyText: string,
  ) {
    super(`Paperclip ${path} failed (${status}): ${bodyText.slice(0, 240)}`);
  }
}

function baseUrl(): string {
  const url = process.env.PAPERCLIP_API_URL;
  if (!url) throw new Error("PAPERCLIP_API_URL is not set");
  return url.replace(/\/$/, "");
}

function apiKey(): string {
  const k = process.env.PAPERCLIP_BOT_API_KEY ?? process.env.PAPERCLIP_API_KEY;
  if (!k) throw new Error("PAPERCLIP_BOT_API_KEY is not set");
  return k;
}

async function call<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey()}`,
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new PaperclipApiError(path, res.status, await res.text());
  }
  return (await res.json()) as T;
}

export type IssueSummary = {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: string;
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
  updatedAt: string;
  goalId?: string | null;
  parentId?: string | null;
};

export type CommentRow = {
  id: string;
  issueId: string;
  body: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  createdAt: string;
};

export function getCompanyId(): string {
  const id = process.env.PAPERCLIP_COMPANY_ID;
  if (!id) throw new Error("PAPERCLIP_COMPANY_ID is not set");
  return id;
}

export async function listAssignedToUser(
  userId: string,
  opts: { updatedAfter?: string; limit?: number } = {},
): Promise<IssueSummary[]> {
  const params = new URLSearchParams();
  params.set("assigneeUserId", userId);
  params.set("status", "todo,in_progress,in_review,blocked");
  if (opts.limit) params.set("limit", String(opts.limit));
  const issues = await call<IssueSummary[] | { issues: IssueSummary[] }>(
    `/api/companies/${getCompanyId()}/issues?${params.toString()}`,
  );
  const list = Array.isArray(issues) ? issues : issues.issues;
  if (!opts.updatedAfter) return list;
  const cutoff = new Date(opts.updatedAfter).getTime();
  return list.filter((i) => new Date(i.updatedAt).getTime() > cutoff);
}

export function getIssue(issueId: string): Promise<IssueSummary & {
  description?: string;
}> {
  return call(`/api/issues/${issueId}`);
}

export async function postComment(
  issueId: string,
  body: string,
): Promise<CommentRow> {
  const res = await call<CommentRow | { comment: CommentRow }>(
    `/api/issues/${issueId}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
  );
  return "comment" in res ? res.comment : res;
}

export async function patchIssue(
  issueId: string,
  patch: Record<string, unknown>,
): Promise<unknown> {
  return call(`/api/issues/${issueId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function createIssue(input: {
  title: string;
  description?: string;
  goalId?: string;
  parentId?: string;
  assigneeAgentId?: string;
  assigneeUserId?: string;
  priority?: string;
}): Promise<IssueSummary> {
  return call(`/api/companies/${getCompanyId()}/issues`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
