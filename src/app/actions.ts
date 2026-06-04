"use server";

import { createHash } from "node:crypto";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  countRecentSubmissions,
  insertIdeas,
  recordSubmissions,
  type IdeaRow,
} from "@/lib/db";
import { runWorkerTick } from "@/lib/worker";

const MAX_LEN_PER_IDEA = 20_000;
const MAX_BATCH = 20;
const SEPARATOR_RE = /^\s*-{3,}\s*$/m;

// Default daily limit per IP. Override via env (e.g. for a test env where you
// want to spam without the admin cookie). Admins (cookie or token) bypass
// the limit entirely.
function getDailyLimit(): number {
  const raw = process.env.PUBLIC_IDEAS_PER_IP_PER_DAY;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 1000) return parsed;
  return 5;
}

function splitBatch(raw: string): string[] {
  const parts = raw
    .split(SEPARATOR_RE)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts;
}

async function getClientIpHash(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0]?.trim() || "unknown"
    : h.get("x-real-ip")?.trim() || "unknown";
  // sha256 hex of the IP. Not reversible without a dictionary attack on the
  // ~4B IPv4 space; we never store the clear IP.
  return createHash("sha256").update(ip).digest("hex");
}

export async function submitIdea(formData: FormData): Promise<void> {
  const raw = formData.get("idea");
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) {
    redirect("/?error=empty");
  }

  const ideas = splitBatch(text);
  if (ideas.length === 0) {
    redirect("/?error=empty");
  }
  if (ideas.length > MAX_BATCH) {
    redirect(`/?error=too-many`);
  }
  for (const idea of ideas) {
    if (idea.length > MAX_LEN_PER_IDEA) {
      redirect("/?error=too-long");
    }
  }

  // Per-IP daily limit. Admins bypass entirely (own testing).
  const isAdmin = await isAdminAuthenticated();
  let ipHash: string | null = null;
  if (!isAdmin) {
    ipHash = await getClientIpHash();
    const limit = getDailyLimit();
    const used = await countRecentSubmissions(ipHash, 24 * 60 * 60);
    if (used >= limit) {
      redirect(`/?error=daily-limit&limit=${limit}`);
    }
    if (used + ideas.length > limit) {
      const remaining = limit - used;
      redirect(
        `/?error=daily-limit-partial&limit=${limit}&remaining=${remaining}&attempted=${ideas.length}`,
      );
    }
  }

  let inserted: IdeaRow[];
  try {
    inserted = await insertIdeas(ideas);
  } catch (err) {
    console.error("[submitIdea] insert failed", err);
    redirect("/?error=insert-failed");
  }

  // Throttle bookkeeping AFTER the successful insert so a failed insert
  // doesn't burn the user's daily budget.
  if (ipHash) {
    try {
      await recordSubmissions(ipHash, inserted.length);
    } catch (err) {
      console.error("[submitIdea] throttle record failed", err);
      // Continue — the analysis is already queued. Worst case the user gets
      // one extra free submission today.
    }
  }

  // Kick the worker without blocking the response.
  after(async () => {
    try {
      await runWorkerTick();
    } catch (err) {
      console.error("[submitIdea] worker tick failed", err);
    }
  });

  if (inserted.length === 1) {
    redirect(`/ideas/${inserted[0].id}`);
  }
  const idsParam = inserted.map((i) => i.id).join(",");
  redirect(`/ideas?ids=${encodeURIComponent(idsParam)}`);
}
