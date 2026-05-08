import Link from "next/link";

import { isAdminAuthenticated } from "@/lib/admin-auth";

import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAdminAuthenticated();
  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/ideas"
              className="font-semibold tracking-tight text-neutral-900"
            >
              IDEAA · Admin
            </Link>
            {authenticated ? (
              <nav className="flex items-center gap-3 text-sm text-neutral-600">
                <Link href="/admin/ideas" className="hover:text-neutral-900">
                  Ideen
                </Link>
                <a
                  href="/api/admin/export?format=json"
                  className="hover:text-neutral-900"
                >
                  Export JSON
                </a>
                <a
                  href="/api/admin/export?format=csv"
                  className="hover:text-neutral-900"
                >
                  Export CSV
                </a>
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-neutral-600 hover:text-neutral-900">
              ← Zur Startseite
            </Link>
            {authenticated ? <LogoutButton /> : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
