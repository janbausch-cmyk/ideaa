import { logoutAction } from "./actions";

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded border border-neutral-300 bg-white px-3 py-1 text-sm text-neutral-700 hover:bg-neutral-100"
      >
        Abmelden
      </button>
    </form>
  );
}
