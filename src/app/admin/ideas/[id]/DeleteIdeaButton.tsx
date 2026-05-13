"use client";

import { deleteIdeaAction } from "./actions";

export default function DeleteIdeaButton({ id }: { id: string }) {
  return (
    <form
      action={deleteIdeaAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Diese Idee wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="w-full rounded-xl border border-rose-300/70 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-900 transition hover:bg-rose-100 dark:border-rose-700/40 dark:bg-rose-950/40 dark:text-rose-200"
      >
        Idee löschen
      </button>
    </form>
  );
}
