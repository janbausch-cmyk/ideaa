"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  generateAndPersistWeeklyPlatformReport,
  weekStartAtFor,
} from "@/lib/platform-report";

async function assertAdminOrRedirect() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

export async function generateReportAction(): Promise<void> {
  await assertAdminOrRedirect();
  const target = weekStartAtFor();
  // Fire-and-forget — generation takes ~30–60s and Next.js server actions
  // would otherwise block the redirect on the LLM call.
  after(async () => {
    try {
      await generateAndPersistWeeklyPlatformReport(target);
    } catch (err) {
      console.error("[platform-report] manual generation failed", err);
    }
  });
  revalidatePath("/admin/platform-reports");
  redirect("/admin/platform-reports?ok=started");
}
