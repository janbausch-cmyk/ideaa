import Link from "next/link";

import BrandWordmark from "@/components/BrandWordmark";
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
    <div className="min-h-full bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="no-print sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--surface)]/85 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--surface)]/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-5">
            <Link
              href="/admin/ideas"
              className="flex items-center gap-2.5 font-bold tracking-tight"
              aria-label="IDEAA Admin"
            >
              <BrandWordmark
                className="brand-peak h-6 w-auto sm:h-7"
                title="IDEAA"
              />
              <span className="text-xs font-medium uppercase tracking-wider text-[color:var(--foreground-muted)]">
                Admin
              </span>
            </Link>
            {authenticated ? (
              <nav className="hidden items-center gap-1 text-sm sm:flex">
                <Link
                  href="/admin/ideas"
                  className="rounded-full px-3 py-1.5 font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  Ideen
                </Link>
                <Link
                  href="/admin/platform-reports"
                  className="rounded-full px-3 py-1.5 font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  Plattform-Berichte
                </Link>
                <Link
                  href="/admin/bots"
                  className="rounded-full px-3 py-1.5 font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                >
                  Bots
                </Link>
                <a
                  href="/api/admin/export?format=json"
                  className="rounded-full px-3 py-1.5 font-medium text-[color:var(--foreground-muted)] transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
                >
                  Export JSON
                </a>
                <a
                  href="/api/admin/export?format=csv"
                  className="rounded-full px-3 py-1.5 font-medium text-[color:var(--foreground-muted)] transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
                >
                  Export CSV
                </a>
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/"
              className="hidden text-[color:var(--foreground-muted)] transition hover:text-[color:var(--brand-ink)] sm:inline"
            >
              ← Zur Startseite
            </Link>
            {authenticated ? <LogoutButton /> : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
