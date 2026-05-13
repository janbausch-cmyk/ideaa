"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  adminDeleteIdea,
  adminUpdateIdea,
  getSql,
  isValidIdeaId,
} from "@/lib/db";
import { processIdeaById } from "@/lib/worker";
import { startDeepdiveForId } from "@/lib/deepdive";

async function assertAdminOrRedirect() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

const VALID_STATUS = new Set(["queued", "running", "done", "failed"]);

export async function setStatusAction(formData: FormData): Promise<void> {
  await assertAdminOrRedirect();
  const id = (formData.get("id") ?? "").toString();
  const status = (formData.get("status") ?? "").toString();
  if (!isValidIdeaId(id) || !VALID_STATUS.has(status)) {
    redirect(`/admin/ideas/${id}?error=invalid_status`);
  }
  await adminUpdateIdea(id, { status });
  revalidatePath(`/admin/ideas/${id}`);
  revalidatePath("/admin/ideas");
  redirect(`/admin/ideas/${id}?ok=status`);
}

export async function setNoteAction(formData: FormData): Promise<void> {
  await assertAdminOrRedirect();
  const id = (formData.get("id") ?? "").toString();
  if (!isValidIdeaId(id)) redirect("/admin/ideas");
  const noteRaw = (formData.get("note") ?? "").toString();
  const note = noteRaw.trim().length === 0 ? null : noteRaw.slice(0, 4_000);
  const tagsRaw = (formData.get("tags") ?? "").toString();
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 50)
    .slice(0, 20);
  await adminUpdateIdea(id, { admin_note: note, tags });
  revalidatePath(`/admin/ideas/${id}`);
  revalidatePath("/admin/ideas");
  redirect(`/admin/ideas/${id}?ok=note`);
}

export async function reanalyzeAction(formData: FormData): Promise<void> {
  await assertAdminOrRedirect();
  const id = (formData.get("id") ?? "").toString();
  if (!isValidIdeaId(id)) redirect("/admin/ideas");
  // Force-requeue: clear the previous result and let the worker pick it up.
  const sql = getSql();
  await sql`
    UPDATE ideas
    SET status = 'queued',
        analysis_started_at = NULL,
        analysis_finished_at = NULL,
        analysis_error = NULL,
        analysis_report = NULL,
        analysis_tool_trace = NULL,
        updated_at = now()
    WHERE id = ${id}::uuid
  `;
  // Kick the worker without blocking the redirect — analysis is long-running.
  after(async () => {
    try {
      await processIdeaById(id, 0);
    } catch (err) {
      console.error("[reanalyzeAction] worker failed", err);
    }
  });
  revalidatePath(`/admin/ideas/${id}`);
  revalidatePath("/admin/ideas");
  redirect(`/admin/ideas/${id}?ok=reanalyze`);
}

export async function deepdiveAction(formData: FormData): Promise<void> {
  await assertAdminOrRedirect();
  const id = (formData.get("id") ?? "").toString();
  if (!isValidIdeaId(id)) redirect("/admin/ideas");
  const sql = getSql();
  // Mark as queued immediately so the UI flips into loading state on the next
  // render. The actual claim → running transition happens inside
  // startDeepdiveForId via claimDeepdive (atomic).
  await sql`
    UPDATE ideas
    SET deepdive_status = 'queued',
        deepdive_started_at = now(),
        deepdive_finished_at = NULL,
        deepdive_error = NULL,
        updated_at = now()
    WHERE id = ${id}::uuid
      AND deepdive_status NOT IN ('running')
  `;
  after(async () => {
    try {
      await startDeepdiveForId(id);
    } catch (err) {
      console.error("[deepdiveAction] runner failed", err);
    }
  });
  revalidatePath(`/admin/ideas/${id}`);
  redirect(`/admin/ideas/${id}?ok=deepdive_started`);
}

export async function deleteIdeaAction(formData: FormData): Promise<void> {
  await assertAdminOrRedirect();
  const id = (formData.get("id") ?? "").toString();
  if (!isValidIdeaId(id)) redirect("/admin/ideas");
  await adminDeleteIdea(id);
  revalidatePath("/admin/ideas");
  redirect("/admin/ideas?ok=deleted");
}
