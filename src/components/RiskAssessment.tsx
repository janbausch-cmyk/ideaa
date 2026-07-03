"use client";

import { useState } from "react";

import type { RiskAssessmentData, RiskSeverity } from "@/lib/risk-parser";

type Props = {
  data: RiskAssessmentData;
};

type SeverityMeta = {
  label: string;
  short: string;
  helper: string;
  accentVar: string; // CSS custom property that holds the accent color
  // Position of the marker on the 0..1 gradient track. Roughly aligned with
  // the 3-stop gradient: low=0.15, medium=0.5, high=0.85.
  meterPosition: number;
};

const SEVERITY_META: Record<RiskSeverity, SeverityMeta> = {
  low: {
    label: "Geringes Risiko",
    short: "Gering",
    helper: "Wenige oder gut mitigierbare Risiken.",
    accentVar: "var(--risk-low)",
    meterPosition: 0.15,
  },
  medium: {
    label: "Mittleres Risiko",
    short: "Mittel",
    helper: "Mehrere reale Risiken mit klaren Kill-Kriterien.",
    accentVar: "var(--risk-medium)",
    meterPosition: 0.5,
  },
  high: {
    label: "Hohes Risiko",
    short: "Hoch",
    helper:
      "Existenzielle, regulatorische oder plattform-abhängige Risiken.",
    accentVar: "var(--risk-high)",
    meterPosition: 0.85,
  },
};

export default function RiskAssessment({ data }: Props) {
  const overall = SEVERITY_META[data.overall];
  const highCount = data.risks.filter((r) => r.severity === "high").length;
  const mediumCount = data.risks.filter((r) => r.severity === "medium").length;
  const lowCount = data.risks.filter((r) => r.severity === "low").length;

  return (
    <section
      className="risk-panel surface-card"
      style={{ ["--risk-accent" as string]: overall.accentVar }}
      aria-labelledby="risk-assessment-heading"
    >
      <div className="risk-panel__header">
        <div className="risk-panel__heading">
          <h2 id="risk-assessment-heading" className="eyebrow">
            Risikobewertung
          </h2>
          <p className="risk-panel__subhead">
            Automatisch aus §3 des Berichts abgeleitet.
          </p>
        </div>

        <div className="risk-panel__hero">
          <RiskGauge severity={data.overall} />
          <div className="risk-panel__hero-text">
            <span className="risk-panel__label">{overall.label}</span>
            <span className="risk-panel__helper">{overall.helper}</span>
            <div className="risk-panel__breakdown">
              <RiskBadge count={highCount} severity="high" />
              <RiskBadge count={mediumCount} severity="medium" />
              <RiskBadge count={lowCount} severity="low" />
            </div>
          </div>
        </div>

        <RiskMeter position={overall.meterPosition} label={overall.label} />
      </div>

      <ul className="risk-panel__list">
        {data.risks.map((risk, idx) => (
          <RiskCard key={idx} risk={risk} index={idx} />
        ))}
      </ul>
    </section>
  );
}

function RiskGauge({ severity }: { severity: RiskSeverity }) {
  const meta = SEVERITY_META[severity];
  // Value 0..100 for the arc fill. Roughly matches meterPosition but scaled.
  const value =
    severity === "low" ? 22 : severity === "medium" ? 58 : 88;
  // Arc geometry: 180° semicircle from (10,60) to (110,60), radius 50.
  const radius = 50;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - value / 100);

  return (
    <div className="risk-gauge" role="img" aria-label={meta.label}>
      <svg
        viewBox="0 0 120 72"
        className="risk-gauge__svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="riskGaugeTrack" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--risk-low)" />
            <stop offset="50%" stopColor="var(--risk-medium)" />
            <stop offset="100%" stopColor="var(--risk-high)" />
          </linearGradient>
        </defs>
        {/* Track */}
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke="var(--risk-track)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Value arc, colored by severity */}
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke="url(#riskGaugeTrack)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="risk-gauge__center">
        <span
          className="risk-gauge__glyph"
          style={{ backgroundColor: meta.accentVar }}
          aria-hidden
        />
      </div>
    </div>
  );
}

function RiskMeter({
  position,
  label,
}: {
  position: number;
  label: string;
}) {
  const pct = Math.max(4, Math.min(96, position * 100));
  return (
    <div
      className="risk-meter"
      role="img"
      aria-label={`Gesamtbewertung: ${label}`}
    >
      <div className="risk-meter__track" />
      <div className="risk-meter__scale" aria-hidden>
        <span>Gering</span>
        <span>Mittel</span>
        <span>Hoch</span>
      </div>
      <div
        className="risk-meter__marker"
        style={{ left: `${pct}%` }}
        aria-hidden
      />
    </div>
  );
}

function RiskBadge({
  count,
  severity,
}: {
  count: number;
  severity: RiskSeverity;
}) {
  if (count === 0) return null;
  const meta = SEVERITY_META[severity];
  return (
    <span
      className="risk-badge"
      style={{ ["--risk-badge-color" as string]: meta.accentVar }}
    >
      <span className="risk-badge__dot" aria-hidden />
      <span className="risk-badge__count">{count}</span>
      <span className="risk-badge__label">{meta.short}</span>
    </span>
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
    <li
      className="risk-card"
      style={{ ["--risk-accent" as string]: meta.accentVar }}
    >
      <div className="risk-card__accent" aria-hidden />
      <div className="risk-card__body">
        <div className="risk-card__row">
          <div className="risk-card__title-block">
            <span className="risk-card__index">{index + 1}</span>
            <h3 className="risk-card__title">{risk.title}</h3>
          </div>
          <span className="risk-card__chip">{meta.short}</span>
        </div>
        {risk.killCriterion ? (
          <p className="risk-card__kill">
            <span className="risk-card__kill-label">Kill-Kriterium</span>
            <span className="risk-card__kill-text">{risk.killCriterion}</span>
          </p>
        ) : null}
        {hasMore ? (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="risk-card__toggle no-print"
              aria-expanded={open}
            >
              {open ? "Weniger anzeigen" : "Details anzeigen"}
              <span
                className={`risk-card__caret ${open ? "risk-card__caret--open" : ""}`}
                aria-hidden
              >
                ›
              </span>
            </button>
            {open ? <p className="risk-card__details">{risk.body}</p> : null}
          </>
        ) : null}
      </div>
    </li>
  );
}
