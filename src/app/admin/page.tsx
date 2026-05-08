import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminRoot() {
  const ok = await isAdminAuthenticated();
  redirect(ok ? "/admin/ideas" : "/admin/login");
}
