"use client";

import { useEffect, useState } from "react";

// Visible signal that something is happening while the LLM analysis runs.
// Three pieces:
//   1. Animated dot trio (typing-style indicator)
//   2. Rotating status hint, cycles every ~6s — gives a sense of progress
//      without faking a percentage
//   3. Elapsed time counter since submit
//
// Pure presentation. The actual status detection + page refresh is handled
// by IdeaStatusPoll.

const STAGES = [
  "Hole mir Marktdaten",
  "Vergleiche mit Konkurrenten",
  "Prüfe Zielgruppe und Wedge",
  "Suche nach Risiken und Stolperfallen",
  "Schreibe deinen Bericht",
];

const STAGE_DURATION_MS = 6000;

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}m ${sec.toString().padStart(2, "0")}s`;
}

export default function AnalysisProgress({
  submittedAtIso,
}: {
  submittedAtIso: string;
}) {
  const submittedAtMs = new Date(submittedAtIso).getTime();
  const [stageIndex, setStageIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(() =>
    Math.max(0, Math.floor((Date.now() - submittedAtMs) / 1000)),
  );

  useEffect(() => {
    const tick = setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - submittedAtMs) / 1000)));
    }, 1000);
    return () => clearInterval(tick);
  }, [submittedAtMs]);

  useEffect(() => {
    const rotate = setInterval(() => {
      setStageIndex((i) => (i + 1) % STAGES.length);
    }, STAGE_DURATION_MS);
    return () => clearInterval(rotate);
  }, []);

  return (
    <section className="surface-card flex flex-col gap-4 p-6 ring-1 ring-amber-300/50 dark:ring-amber-800/40">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5" aria-label="Analyse läuft">
          <span className="block h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:-0.3s]" />
          <span className="block h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:-0.15s]" />
          <span className="block h-2 w-2 animate-bounce rounded-full bg-amber-500" />
        </span>
        <h2 className="eyebrow !text-[color:var(--foreground)]">
          Deine Analyse läuft
        </h2>
        <span className="ml-auto rounded-full bg-[color:var(--surface-muted)] px-2.5 py-0.5 font-mono text-xs text-[color:var(--foreground-muted)]">
          {formatElapsed(elapsedSec)}
        </span>
      </div>

      <p
        key={stageIndex}
        className="animate-fade-in text-sm text-[color:var(--foreground)]"
      >
        {STAGES[stageIndex]}…
      </p>

      <div className="flex flex-col gap-2 pt-1">
        <SkeletonLine width="w-5/6" />
        <SkeletonLine width="w-4/6" />
        <SkeletonLine width="w-3/5" />
      </div>

      <p className="text-xs text-[color:var(--foreground-muted)]">
        Dauert normalerweise 60 bis 90 Sekunden. Du kannst die Seite offen
        lassen, sie aktualisiert sich automatisch.
      </p>
    </section>
  );
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <span
      aria-hidden
      className={`block h-3 ${width} animate-pulse rounded bg-[color:var(--surface-muted)]`}
    />
  );
}
