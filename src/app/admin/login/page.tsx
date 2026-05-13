import { redirect } from "next/navigation";

import { getExpectedAdminToken, isAdminAuthenticated } from "@/lib/admin-auth";

import { loginAction } from "../actions";

export const dynamic = "force-dynamic";

type ErrorKey = "invalid" | "not_configured";

const ERROR_MESSAGES: Record<ErrorKey, string> = {
  invalid: "Token ungültig. Bitte erneut versuchen.",
  not_configured:
    "ADMIN_TOKEN ist auf diesem Deployment nicht gesetzt. Admin-Login ist deaktiviert.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const authenticated = await isAdminAuthenticated();
  if (authenticated) {
    redirect("/admin/ideas");
  }
  const params = await searchParams;
  const errorKey = params.error as ErrorKey | undefined;
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : null;
  const tokenConfigured = Boolean(getExpectedAdminToken());

  return (
    <div className="mx-auto max-w-md">
      <span className="eyebrow">Geschützter Bereich</span>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Admin-Login</h1>
      <p className="mt-3 text-sm text-[color:var(--foreground-muted)]">
        Diesen Bereich schützt das gemeinsame Geheimnis{" "}
        <code className="rounded bg-[color:var(--surface-muted)] px-1.5 py-0.5 font-mono text-xs">
          ADMIN_TOKEN
        </code>
        . Nach dem Login wird ein HttpOnly-Cookie gesetzt (7 Tage gültig).
      </p>
      {!tokenConfigured && (
        <div className="mt-5 rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-200">
          <strong className="font-semibold">Achtung:</strong>{" "}
          <code className="font-mono">ADMIN_TOKEN</code> ist auf diesem
          Deployment nicht gesetzt. Login ist deaktiviert. In Vercel Project
          Settings → Environment Variables nachtragen.
        </div>
      )}
      {errorMessage && (
        <div className="mt-5 rounded-xl border border-rose-300/70 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-700/40 dark:bg-rose-950/40 dark:text-rose-200">
          {errorMessage}
        </div>
      )}
      <form action={loginAction} className="surface-card mt-6 space-y-4 p-6">
        <label className="block">
          <span className="text-sm font-semibold text-[color:var(--foreground)]">
            Token
          </span>
          <input
            type="password"
            name="token"
            autoComplete="off"
            required
            disabled={!tokenConfigured}
            className="mt-2 block w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 font-mono text-sm shadow-inner focus:border-[color:var(--brand-ink)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ink)]/20 disabled:bg-[color:var(--surface-muted)]"
          />
        </label>
        <button
          type="submit"
          disabled={!tokenConfigured}
          className="brand-button inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed"
        >
          Anmelden
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M13 5l7 7-7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
}
