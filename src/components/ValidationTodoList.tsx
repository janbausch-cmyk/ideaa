"use client";

import { useMemo, useState } from "react";

import type {
  FlowchartData,
  Gate,
  GateDecision,
} from "@/lib/flowchart-parser";

// Renders the 30-day validation plan as an actionable Todo list — goal on
// top, weekly milestones with action/test/metric as checkable rows and
// decision gates in between. Two export paths: copy Markdown to clipboard
// or download a `.md` file, so the user can pull the plan into their own
// tool.

type Props = {
  goal: string;
  data: FlowchartData;
  lang: "de" | "en";
};

const COPY = {
  heading: { de: "Validierungs-Todo", en: "Validation todo" },
  subhead: {
    de: "30-Tage-Plan: Ziel oben, Wochen-Meilensteine mit Maßnahmen darunter. Kopieren oder als Markdown exportieren.",
    en: "30-day plan: goal on top, weekly milestones below. Copy or export as Markdown.",
  },
  goalLabel: { de: "Ziel", en: "Goal" },
  milestonesLabel: { de: "Meilensteine", en: "Milestones" },
  copyBtn: { de: "Markdown kopieren", en: "Copy Markdown" },
  copied: { de: "Kopiert!", en: "Copied!" },
  copyFailed: { de: "Kopieren fehlgeschlagen", en: "Copy failed" },
  downloadBtn: { de: "Als .md speichern", en: "Download .md" },
  actionLbl: { de: "Aktion", en: "Action" },
  testLbl: { de: "Test", en: "Test" },
  metricLbl: { de: "Metrik", en: "Metric" },
  gateLbl: { de: "Entscheidungs-Gate", en: "Decision gate" },
} as const;

const DECISION_LABEL: Record<GateDecision, Record<"de" | "en", string>> = {
  continue: { de: "Weiter", en: "Continue" },
  pivot: { de: "Pivot", en: "Pivot" },
  kill: { de: "Stopp", en: "Kill" },
};

function gateAfterWeek(day: number): number {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

function buildMarkdown(
  goal: string,
  data: FlowchartData,
  lang: "de" | "en",
): string {
  const gatesByWeek = new Map<number, Gate>();
  for (const g of data.gates) {
    const wk = gateAfterWeek(g.day);
    if (!gatesByWeek.has(wk)) gatesByWeek.set(wk, g);
  }
  const lines: string[] = [];
  lines.push(`# ${COPY.heading[lang]}`);
  lines.push("");
  lines.push(`## ${COPY.goalLabel[lang]}`);
  lines.push("");
  const cleanGoal = goal.trim().replace(/\r/g, "");
  for (const gline of cleanGoal.split(/\n+/)) {
    lines.push(`> ${gline}`);
  }
  lines.push("");
  lines.push(`## ${COPY.milestonesLabel[lang]}`);
  lines.push("");
  const weeks = data.weeks.length > 0 ? data.weeks : [];
  for (const week of weeks) {
    const headline = week.headline ? ` — ${week.headline}` : "";
    lines.push(`### ${week.label}${headline}`);
    lines.push("");
    if (week.action) lines.push(`- [ ] **${COPY.actionLbl[lang]}:** ${week.action}`);
    if (week.test) lines.push(`- [ ] **${COPY.testLbl[lang]}:** ${week.test}`);
    if (week.metric) lines.push(`- [ ] **${COPY.metricLbl[lang]}:** ${week.metric}`);
    if (!week.action && !week.test && !week.metric && week.headline) {
      lines.push(`- [ ] ${week.headline}`);
    }
    lines.push("");
    const gate = gatesByWeek.get(week.index);
    if (gate) {
      const decisions = gate.decisions
        .map((d) => DECISION_LABEL[d][lang])
        .join(" / ");
      lines.push(`> **${COPY.gateLbl[lang]} — ${gate.label}:** ${decisions}`);
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd() + "\n";
}

export default function ValidationTodoList({ goal, data, lang }: Props) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const markdown = useMemo(() => buildMarkdown(goal, data, lang), [
    goal,
    data,
    lang,
  ]);

  const gatesByWeek = useMemo(() => {
    const m = new Map<number, Gate>();
    for (const g of data.gates) {
      const wk = gateAfterWeek(g.day);
      if (!m.has(wk)) m.set(wk, g);
    }
    return m;
  }, [data]);

  const weeks = data.weeks;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(markdown);
        setCopyState("copied");
      } else {
        throw new Error("Clipboard unavailable");
      }
    } catch {
      setCopyState("error");
    }
    setTimeout(() => setCopyState("idle"), 2200);
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      lang === "de" ? "validierungs-todo.md" : "validation-todo.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyLabel =
    copyState === "copied"
      ? COPY.copied[lang]
      : copyState === "error"
        ? COPY.copyFailed[lang]
        : COPY.copyBtn[lang];

  return (
    <section
      className="todo-panel surface-card"
      aria-labelledby="validation-todo-heading"
    >
      <div className="todo-panel__header">
        <div className="todo-panel__heading">
          <h2 id="validation-todo-heading" className="eyebrow">
            {COPY.heading[lang]}
          </h2>
          <p className="todo-panel__subhead">{COPY.subhead[lang]}</p>
        </div>
        <div className="todo-panel__actions no-print">
          <button
            type="button"
            onClick={handleCopy}
            className={`todo-btn todo-btn--primary${
              copyState === "copied" ? " todo-btn--success" : ""
            }`}
            aria-live="polite"
          >
            {copyLabel}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="todo-btn todo-btn--secondary"
          >
            {COPY.downloadBtn[lang]}
          </button>
        </div>
      </div>

      <div className="todo-goal">
        <span className="todo-goal__label">{COPY.goalLabel[lang]}</span>
        <p className="todo-goal__text">{goal}</p>
      </div>

      <div className="todo-milestones">
        <h3 className="todo-milestones__label">{COPY.milestonesLabel[lang]}</h3>
        <ol className="todo-list">
          {weeks.map((week) => {
            const gate = gatesByWeek.get(week.index) ?? null;
            const rows: Array<{ key: "action" | "test" | "metric"; text: string }> =
              [];
            if (week.action) rows.push({ key: "action", text: week.action });
            if (week.test) rows.push({ key: "test", text: week.test });
            if (week.metric) rows.push({ key: "metric", text: week.metric });
            const fallback =
              rows.length === 0 && week.headline ? week.headline : null;
            return (
              <li key={week.index} className="todo-milestone">
                <div className="todo-milestone__header">
                  <span className="todo-milestone__badge" aria-hidden>
                    {week.index}
                  </span>
                  <div className="todo-milestone__title">
                    <span className="todo-milestone__label">{week.label}</span>
                    {week.headline ? (
                      <span className="todo-milestone__headline">
                        {week.headline}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ul className="todo-items">
                  {fallback ? (
                    <TodoRow label="" text={fallback} tone="action" />
                  ) : (
                    rows.map((row) => (
                      <TodoRow
                        key={row.key}
                        label={
                          row.key === "action"
                            ? COPY.actionLbl[lang]
                            : row.key === "test"
                              ? COPY.testLbl[lang]
                              : COPY.metricLbl[lang]
                        }
                        text={row.text}
                        tone={row.key}
                      />
                    ))
                  )}
                </ul>
                {gate ? <GateRow gate={gate} lang={lang} /> : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function TodoRow({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: "action" | "test" | "metric";
}) {
  return (
    <li className={`todo-item todo-item--${tone}`}>
      <span className="todo-item__check" aria-hidden>
        <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden>
          <path
            d="M3 8.2l3.2 3.2L13 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="todo-item__body">
        {label ? <span className="todo-item__label">{label}</span> : null}
        <span className="todo-item__text">{text}</span>
      </div>
    </li>
  );
}

function GateRow({ gate, lang }: { gate: Gate; lang: "de" | "en" }) {
  return (
    <div className="todo-gate" aria-label={`${gate.label}: ${gate.summary}`}>
      <span className="todo-gate__diamond" aria-hidden />
      <div className="todo-gate__body">
        <span className="todo-gate__label">{gate.label}</span>
        <ul className="todo-gate__paths">
          {gate.decisions.map((decision) => (
            <li
              key={decision}
              className={`todo-gate__path todo-gate__path--${decision}`}
            >
              <span className="todo-gate__dot" aria-hidden />
              {DECISION_LABEL[decision][lang]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
