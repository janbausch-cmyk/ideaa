export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-16 text-center font-sans dark:bg-black">
      <div className="flex max-w-2xl flex-col items-center gap-6">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
          IDEAA
        </h1>
        <p className="text-lg leading-8 text-zinc-700 dark:text-zinc-300 sm:text-xl">
          Paste an idea, get a validation report.
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          v0 — coming soon.
        </p>
      </div>
    </main>
  );
}
