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
    <main className="flex min-h-screen flex-col items-center bg-zinc-50 px-6 py-12 font-sans dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← New idea
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Your ideas
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Status updates live every few seconds. Click any ready idea to
            open its report.
          </p>
        </header>

        <IdeasIndex submittedIds={submittedIds} />
      </div>
    </main>
  );
}
