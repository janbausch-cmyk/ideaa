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
        className="w-full rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900 hover:bg-rose-100"
      >
        Idee löschen
      </button>
    </form>
  );
}
