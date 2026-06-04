import Link from "next/link";

import BrandWordmark from "@/components/BrandWordmark";
import LegalFooter from "@/components/LegalFooter";
import PreviousIdeasList from "@/components/PreviousIdeasList";

import { submitIdea } from "./actions";

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
          <span className="eyebrow">Geschäftsidee einreichen</span>
          <h1 className="sr-only">IDEAA</h1>
          <Link href="/geschaeftsidee-validieren" aria-label="IDEAA, zur Startseite">
            <BrandWordmark
              className="brand-peak h-14 w-auto transition hover:opacity-80 sm:h-16"
              title="IDEAA"
            />
          </Link>
          <p className="max-w-md text-base text-[color:var(--foreground-muted)] sm:text-lg">
            Schreib deine Idee unten rein. Du bekommst eine Einschätzung zu
            Markt, Konkurrenz und Risiken sowie einen ersten Umsetzungsplan.
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
            Mehrere Ideen auf einmal? Trenn sie mit einer Zeile aus{" "}
            <code className="rounded bg-[color:var(--surface-muted)] px-1.5 py-0.5 font-mono text-[11px]">
              ---
            </code>
            . Bis zu 20 Stück, je 20.000 Zeichen. Sie werden parallel
            analysiert.
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
              Frühere Ideen anschauen
            </Link>
          </div>
        </form>

        <PreviousIdeasList />

        <p className="text-center text-xs text-[color:var(--foreground-muted)]">
          Kein Account nötig. Jede Idee bekommt eine eigene URL, die du
          speichern oder weitergeben kannst.
        </p>

        <LegalFooter />
      </div>
    </main>
  );
}
