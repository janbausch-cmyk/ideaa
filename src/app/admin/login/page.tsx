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
      <h1 className="text-2xl font-semibold tracking-tight">Admin-Login</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Diesen Bereich schützt das gemeinsame Geheimnis{" "}
        <code className="rounded bg-neutral-100 px-1">ADMIN_TOKEN</code>.
        Nach dem Login wird ein HttpOnly-Cookie gesetzt (7 Tage gültig).
      </p>
      {!tokenConfigured && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Achtung: <code>ADMIN_TOKEN</code> ist auf diesem Deployment nicht
          gesetzt. Login ist deaktiviert. In Vercel Project Settings →
          Environment Variables nachtragen.
        </div>
      )}
      {errorMessage && (
        <div className="mt-4 rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          {errorMessage}
        </div>
      )}
      <form action={loginAction} className="mt-6 space-y-3">
        <label className="block text-sm font-medium text-neutral-700">
          Token
          <input
            type="password"
            name="token"
            autoComplete="off"
            required
            disabled={!tokenConfigured}
            className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-neutral-500 focus:outline-none disabled:bg-neutral-100"
          />
        </label>
        <button
          type="submit"
          disabled={!tokenConfigured}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          Anmelden
        </button>
      </form>
    </div>
  );
}
