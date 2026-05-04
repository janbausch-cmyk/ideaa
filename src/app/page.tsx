import PreviousIdeasList from "@/components/PreviousIdeasList";

import { submitIdea } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  empty: "Please paste an idea before submitting.",
  "too-long": "Idea is too long (max 20,000 characters).",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : null;
  const errorMessage = errorKey ? (ERRORS[errorKey] ?? null) : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
            IDEAA
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-300">
            Paste an idea, get a validation report.
          </p>
        </header>

        <form
          action={submitIdea}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <label
            htmlFor="idea"
            className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            Your idea
          </label>
          <textarea
            id="idea"
            name="idea"
            required
            rows={10}
            maxLength={20000}
            placeholder="A subscription box for…"
            className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          {errorMessage ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="submit"
            className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Submit idea
          </button>
        </form>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Plain HTML, single-tenant, v0. No accounts. Your idea is saved with a
          shareable URL you can return to.
        </p>

        <PreviousIdeasList />
      </div>
    </main>
  );
}
