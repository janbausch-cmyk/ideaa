import { logoutAction } from "./actions";

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] shadow-sm transition hover:border-[color:var(--brand-ink)]/40 hover:text-[color:var(--brand-ink)]"
      >
        Abmelden
      </button>
    </form>
  );
}
