"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_COOKIE,
  getExpectedAdminToken,
  isValidAdminToken,
} from "@/lib/admin-auth";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function loginAction(formData: FormData): Promise<void> {
  const token = (formData.get("token") ?? "").toString().trim();
  if (!getExpectedAdminToken()) {
    redirect("/admin/login?error=not_configured");
  }
  if (!isValidAdminToken(token)) {
    redirect("/admin/login?error=invalid");
  }
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  redirect("/admin/ideas");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
