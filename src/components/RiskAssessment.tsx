"use client";

import { useState } from "react";

import type { RiskAssessmentData, RiskSeverity } from "@/lib/risk-parser";

type Props = {
  data: RiskAssessmentData;
};

type SeverityMeta = {
  emoji: string;
  label: string;
  helper: string;
  ringClass: string;
  chipClass: string;
  dotClass: string;
  bandClass: string;
};

const SEVERITY_META: Record<RiskSeverity, SeverityMeta> = {
  low: {
    emoji: "🟢",
    label: "Geringes Risiko",
    helper: "Wenige oder gut mitigierbare Risiken.",
    ringClass: "ring-1 ring-emerald-300/60 dark:ring-emerald-800/50",
    chipClass:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/60",
    dotClass: "bg-emerald-500",
    bandClass: "bg-emerald-500",
  },
  medium: {
    emoji: "🟡",
    label: "Mittleres Risiko",
    helper: "Mehrere reale Risiken mit klaren Kill-Kriterien.",
    ringClass: "ring-1 ring-amber-300/60 dark:ring-amber-800/50",
    chipClass:
      "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60",
    dotClass: "bg-amber-500",
    bandClass: "bg-amber-500",
  },
  high: {
    emoji: "🔴",
    label: "Hohes Risiko",
    helper:
      "Existenzielle, regulatorische oder plattform-abhängige Risiken vorhanden.",
    ringClass: "ring-1 ring-rose-300/60 dark:ring-rose-800/50",
    chipClass:
      "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800/60",
    dotClass: "bg-rose-500",
    bandClass: "bg-rose-500",
  },
};

const SEVERITY_ORDER: RiskSeverity[] = ["low", "medium", "high"];

export default function RiskAssessment({ data }: Props) {
  const overall = SEVERITY_META[data.overall];
  const overallIdx = SEVERITY_ORDER.indexOf(data.overall);

  return (
    <section
      className={`surface-card flex flex-col gap-4 p-6 sm:p-7 ${overall.ringClass}`}
      aria-labelledby="risk-assessment-heading"
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="risk-assessment-heading" className="eyebrow">
            Risikobewertung
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${overall.chipClass}`}
          >
            <span aria-hidden>{overall.emoji}</span>
            <span>{overall.label}</span>
          </span>
        </div>
        <p className="text-sm text-[color:var(--foreground-muted)]">
          {overall.helper} Automatisch aus §3 des Berichts abgeleitet.
        </p>
        <div
          className="flex h-2 w-full overflow-hidden rounded-full bg-[color:var(--surface-muted)]"
          role="img"
          aria-label={`Gesamtbewertung: ${overall.label}`}
        >
          {SEVERITY_ORDER.map((sev, idx) => {
            const active = idx <= overallIdx;
            return (
              <div
                key={sev}
                className={`flex-1 transition ${
                  active ? SEVERITY_META[sev].bandClass : "opacity-25"
                } ${active ? "" : SEVERITY_META[sev].bandClass}`}
              />
            );
          })}
        </div>
      </header>

      <ul className="flex flex-col gap-2.5">
        {data.risks.map((risk, idx) => (
          <RiskCard key={idx} risk={risk} index={idx} />
        ))}
      </ul>
    </section>
  );
}

function RiskCard({
  risk,
  index,
}: {
  risk: RiskAssessmentData["risks"][number];
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const meta = SEVERITY_META[risk.severity];
  const hasMore = risk.body.trim().length > risk.title.trim().length + 20;

  return (
    <li>
      <div
        className={`surface-card-flat flex flex-col gap-2 p-4 ${meta.ringClass}`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full ${meta.dotClass}`}
            aria-hidden
          />
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-mono text-[color:var(--foreground-muted)]">
                #{index + 1}
              </span>
              <h3 className="text-sm font-semibold leading-snug text-[color:var(--foreground)]">
                {risk.title}
              </h3>
            </div>
            {risk.killCriterion ? (
              <p className="text-xs text-[color:var(--foreground-muted)]">
                <span className="font-semibold text-[color:var(--foreground)]">
                  Kill-Kriterium:
                </span>{" "}
                {risk.killCriterion}
              </p>
            ) : null}
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.chipClass}`}
          >
            {severityShort(risk.severity)}
          </span>
        </div>
        {hasMore ? (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="no-print self-start text-xs font-medium text-[color:var(--brand-ink)] transition hover:underline"
              aria-expanded={open}
            >
              {open ? "Weniger anzeigen" : "Details anzeigen"}
            </button>
            {open ? (
              <p className="text-xs leading-relaxed text-[color:var(--foreground)]">
                {risk.body}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </li>
  );
}

function severityShort(sev: RiskSeverity): string {
  switch (sev) {
    case "high":
      return "Hoch";
    case "medium":
      return "Mittel";
    case "low":
      return "Gering";
  }
}
