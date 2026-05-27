"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";

import { insertIdeas, type IdeaRow } from "@/lib/db";
import { runWorkerTick } from "@/lib/worker";

const MAX_LEN_PER_IDEA = 20_000;
const MAX_BATCH = 20;
const SEPARATOR_RE = /^\s*-{3,}\s*$/m;

function splitBatch(raw: string): string[] {
  // Ideas are separated by a line consisting of three or more dashes.
  // Single-idea submissions (no separator line) work unchanged.
  const parts = raw
    .split(SEPARATOR_RE)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts;
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

  let inserted: IdeaRow[];
  try {
    inserted = await insertIdeas(ideas);
  } catch (err) {
    console.error("[submitIdea] insert failed", err);
    redirect("/?error=insert-failed");
  }

  // Kick the worker without blocking the response. The tick claims rows via
  // SKIP LOCKED with bounded concurrency.
  after(async () => {
    try {
      await runWorkerTick();
    } catch (err) {
      console.error("[submitIdea] worker tick failed", err);
    }
  });

  // Single idea → land on its detail page (legacy v0 UX). Batch → land on
  // the index where the user can see all of them in flight.
  if (inserted.length === 1) {
    redirect(`/ideas/${inserted[0].id}`);
  }
  const idsParam = inserted.map((i) => i.id).join(",");
  redirect(`/ideas?ids=${encodeURIComponent(idsParam)}`);
}
