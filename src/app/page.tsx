import Link from "next/link";

import BrandWordmark from "@/components/BrandWordmark";
import PreviousIdeasList from "@/components/PreviousIdeasList";

import { submitIdea } from "./actions";

export const dynamic = "force-dynamic";
// The submit server action kicks the worker tick via after(); a typical
// analysis takes 60–90s and a 5-idea batch with concurrency 3 needs ~180s.
// Without this, the after() handler is killed before the second wave of
// claims completes and rows are stranded in 'running'.
export const maxDuration = 300;

const ERRORS: Record<string, string> = {
  empty: "Please paste an idea before submitting.",
  "too-long": "One of the ideas is too long (max 20,000 characters each).",
  "too-many": "Too many ideas in one batch (max 20).",
  "insert-failed": "Could not save your idea. Please try again.",
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
    <main className="app-backdrop flex min-h-screen flex-col items-center px-6 py-16 sm:py-24">
      <div className="flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col items-center gap-4 text-center">
          <span className="eyebrow">Idea → validated business case</span>
          <h1 className="sr-only">IDEAA</h1>
          <BrandWordmark
            className="brand-peak h-14 w-auto sm:h-16"
            title="IDEAA"
          />
          <p className="max-w-md text-base text-[color:var(--foreground-muted)] sm:text-lg">
            Paste a raw idea. Get a structured validation report and a plan you
            can act on.
          </p>
        </header>

        <form
          action={submitIdea}
          className="surface-card flex flex-col gap-4 p-5 sm:p-6"
        >
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="idea"
              className="text-sm font-semibold text-[color:var(--foreground)]"
            >
              Your idea
            </label>
            <span className="text-[10px] uppercase tracking-wider text-[color:var(--foreground-muted)]">
              up to 20 at once
            </span>
          </div>
          <textarea
            id="idea"
            name="idea"
            required
            rows={10}
            placeholder={"A subscription box for…\n\n---\n\nA marketplace where…"}
            className="w-full resize-y rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm leading-relaxed text-[color:var(--foreground)] placeholder:text-[color:var(--foreground-muted)]/70 shadow-inner focus:border-[color:var(--brand-ink)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ink)]/20"
          />
          <p className="text-xs text-[color:var(--foreground-muted)]">
            Tip: paste several ideas at once, separated by a line of{" "}
            <code className="rounded bg-[color:var(--surface-muted)] px-1.5 py-0.5 font-mono text-[11px]">
              ---
            </code>{" "}
            (max 20 per batch, 20,000 chars each). They run in parallel.
          </p>
          {errorMessage ? (
            <p className="rounded-lg border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
              {errorMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              className="brand-button inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              Submit idea
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
            <Link
              href="/ideas"
              className="text-sm font-medium text-[color:var(--brand-ink)] hover:underline"
            >
              See all your ideas →
            </Link>
          </div>
        </form>

        <PreviousIdeasList />

        <p className="text-center text-xs text-[color:var(--foreground-muted)]">
          No accounts needed. Each idea is saved at its own shareable URL you
          can return to.
        </p>

        <p className="text-center text-xs text-[color:var(--foreground-muted)]">
          <Link
            href="/geschaeftsidee-validieren"
            className="hover:underline"
            hrefLang="de"
          >
            Deutsch: Geschäftsidee validieren →
          </Link>
        </p>
      </div>
    </main>
  );
}
