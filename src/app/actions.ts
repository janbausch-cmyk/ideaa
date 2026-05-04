"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";

import { analyzeIdea } from "@/lib/analysis";
import { insertIdea } from "@/lib/db";

const MAX_LEN = 20_000;

export async function submitIdea(formData: FormData): Promise<void> {
  const raw = formData.get("idea");
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) {
    redirect("/?error=empty");
  }
  if (text.length > MAX_LEN) {
    redirect("/?error=too-long");
  }
  const idea = await insertIdea(text);
  after(async () => {
    await analyzeIdea(idea.id);
  });
  redirect(`/ideas/${idea.id}`);
}
