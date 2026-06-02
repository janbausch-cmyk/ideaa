import Link from "next/link";

import BrandWordmark from "@/components/BrandWordmark";
import PreviousIdeasList from "@/components/PreviousIdeasList";

import { submitIdea } from "../actions";

export const dynamic = "force-dynamic";
// The submit server action kicks the worker tick via after(); a typical
// analysis takes 60–90s and a 5-idea batch with concurrency 3 needs ~180s.
// Without this, the after() handler is killed before the second wave of
// claims completes and rows are stranded in 'running'.
export const maxDuration = 300;

const ERRORS: Record<string, string> = {
  empty: "Bitte füge eine Idee ein, bevor du absendest.",
  "too-long": "Eine der Ideen ist zu lang (max. 20.000 Zeichen pro Idee).",
  "too-many": "Zu viele Ideen auf einmal (max. 20 pro Durchlauf).",
  "insert-failed":
    "Deine Idee konnte nicht gespeichert werden. Bitte versuche es erneut.",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ValidierenPage({
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
          <span className="eyebrow">Idee → validierter Geschäftsfall</span>
          <h1 className="sr-only">IDEAA</h1>
          <BrandWordmark
            className="brand-peak h-14 w-auto sm:h-16"
            title="IDEAA"
          />
          <p className="max-w-md text-base text-[color:var(--foreground-muted)] sm:text-lg">
            Füge eine rohe Idee ein. Erhalte einen strukturierten
            Validierungsbericht und einen Plan, mit dem du loslegen kannst.
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
              Deine Idee
            </label>
            <span className="text-[10px] uppercase tracking-wider text-[color:var(--foreground-muted)]">
              bis zu 20 auf einmal
            </span>
          </div>
          <textarea
            id="idea"
            name="idea"
            required
            rows={10}
            placeholder={"Eine Abo-Box für…\n\n---\n\nEin Marktplatz, auf dem…"}
            className="w-full resize-y rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm leading-relaxed text-[color:var(--foreground)] placeholder:text-[color:var(--foreground-muted)]/70 shadow-inner focus:border-[color:var(--brand-ink)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ink)]/20"
          />
          <p className="text-xs text-[color:var(--foreground-muted)]">
            Tipp: Füge mehrere Ideen auf einmal ein, getrennt durch eine Zeile
            aus{" "}
            <code className="rounded bg-[color:var(--surface-muted)] px-1.5 py-0.5 font-mono text-[11px]">
              ---
            </code>{" "}
            (max. 20 pro Durchlauf, je 20.000 Zeichen). Sie laufen parallel.
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
              Idee absenden
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
              Alle deine Ideen ansehen →
            </Link>
          </div>
        </form>

        <PreviousIdeasList />

        <p className="text-center text-xs text-[color:var(--foreground-muted)]">
          Kein Account nötig. Jede Idee wird unter einer eigenen, teilbaren URL
          gespeichert, zu der du jederzeit zurückkehren kannst.
        </p>

        <p className="text-center text-xs text-[color:var(--foreground-muted)]">
          <Link href="/" className="hover:underline">
            ← Zurück zur Startseite
          </Link>
        </p>
      </div>
    </main>
  );
}
