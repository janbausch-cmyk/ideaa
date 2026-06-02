import Link from "next/link";

import IdeasIndex from "@/components/IdeasIndex";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function parseIds(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default async function IdeasIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const submittedIds = parseIds(params.ids);

  return (
    <main className="app-backdrop flex min-h-screen flex-col items-center px-6 py-12 sm:py-16">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <Link
            href="/validieren"
            className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[color:var(--foreground-muted)] transition hover:text-[color:var(--brand-ink)]"
          >
            <span aria-hidden>←</span> Neue Idee
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-4xl">
            Deine Ideen
          </h1>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Der Status aktualisiert sich live im Sekundentakt. Klicke auf eine
            fertige Idee, um ihren Bericht zu öffnen.
          </p>
        </header>

        <IdeasIndex submittedIds={submittedIds} />
      </div>
    </main>
  );
}
