import type { FlowchartData, Gate, GateDecision } from "@/lib/flowchart-parser";

// Renders the parsed §8/§9 shape as a horizontal "idea lifecycle" —
// weekly stops on a brand-gradient timeline, with decision gates in between
// carrying traffic-light branches (continue / pivot / kill). Replaces the
// old Mermaid flowchart: the Mermaid look didn't match the site design, and
// a hand-tuned SVG timeline lets us mirror the RiskAssessment visual system.

type Props = {
  data: FlowchartData;
  lang: "de" | "en";
};

const DECISION_LABEL: Record<GateDecision, Record<"de" | "en", string>> = {
  continue: { de: "Weiter", en: "Continue" },
  pivot: { de: "Pivot", en: "Pivot" },
  kill: { de: "Stopp", en: "Kill" },
};

const KILL_TEXT: Record<"de" | "en", string> = {
  de: "Idee stoppen",
  en: "Kill idea",
};
const PIVOT_TEXT: Record<"de" | "en", string> = {
  de: "Wedge pivotieren",
  en: "Pivot wedge",
};

const SUBLINE: Record<"action" | "test" | "metric", Record<"de" | "en", string>> = {
  action: { de: "Aktion", en: "Action" },
  test: { de: "Test", en: "Test" },
  metric: { de: "Metrik", en: "Metric" },
};

const COPY = {
  heading: { de: "Lebenszyklus der Idee", en: "Idea lifecycle" },
  subhead: {
    de: "Vier Wochen vom Roh-Signal zum v0-Grünlicht, mit Entscheidungs-Gates dazwischen.",
    en: "Four weeks from raw signal to v0 green light, with decision gates in between.",
  },
  start: { de: "Start", en: "Start" },
  startHint: { de: "Roh-Idee", en: "Raw idea" },
  end: { de: "v0 bauen", en: "Ship v0" },
  endHint: { de: "Grünes Licht", en: "Green light" },
  gate: { de: "Gate", en: "Gate" },
};

function gateAfterWeek(day: number): number {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

export default function IdeaLifecycle({ data, lang }: Props) {
  const gatesByWeek = new Map<number, Gate>();
  for (const gate of data.gates) {
    const wk = gateAfterWeek(gate.day);
    if (!gatesByWeek.has(wk)) gatesByWeek.set(wk, gate);
  }

  const weeks =
    data.weeks.length > 0
      ? data.weeks
      : Array.from(gatesByWeek.keys())
          .sort((a, b) => a - b)
          .map((idx) => ({
            index: idx,
            label: lang === "de" ? `Woche ${idx}` : `Week ${idx}`,
            headline: "",
          }));

  return (
    <section
      className="lifecycle-panel surface-card"
      aria-labelledby="idea-lifecycle-heading"
    >
      <div className="lifecycle-panel__header">
        <h2 id="idea-lifecycle-heading" className="eyebrow">
          {COPY.heading[lang]}
        </h2>
        <p className="lifecycle-panel__subhead">{COPY.subhead[lang]}</p>
      </div>

      <div className="lifecycle-scroll">
        <div className="lifecycle-timeline">
          <div className="lifecycle-track" aria-hidden />

          <LifecycleStart lang={lang} />

          {weeks.map((week, idx) => {
            const gate = gatesByWeek.get(week.index) ?? null;
            const tone = weekTone(week.index);
            return (
              <div key={week.index} className="lifecycle-cluster">
                <LifecycleWeek
                  week={week}
                  tone={tone}
                  isLast={idx === weeks.length - 1 && !gate}
                  lang={lang}
                />
                {gate ? <LifecycleGate gate={gate} lang={lang} /> : null}
              </div>
            );
          })}

          <LifecycleEnd lang={lang} />
        </div>
      </div>
    </section>
  );
}

function weekTone(index: number): "from" | "via" | "to" | "ink" {
  // Cycle through the brand palette so consecutive weeks stay visually
  // distinct but coherent with the site gradient.
  const cycle: Array<"from" | "via" | "to" | "ink"> = [
    "from",
    "via",
    "to",
    "ink",
  ];
  return cycle[(index - 1) % cycle.length];
}

function LifecycleStart({ lang }: { lang: "de" | "en" }) {
  return (
    <div className="lifecycle-cluster lifecycle-cluster--endpoint">
      <div className="lifecycle-node lifecycle-node--start">
        <span className="lifecycle-node__pin" aria-hidden />
        <div className="lifecycle-node__body">
          <span className="lifecycle-node__eyebrow">{COPY.start[lang]}</span>
          <span className="lifecycle-node__title">{COPY.startHint[lang]}</span>
        </div>
      </div>
    </div>
  );
}

function LifecycleEnd({ lang }: { lang: "de" | "en" }) {
  return (
    <div className="lifecycle-cluster lifecycle-cluster--endpoint">
      <div className="lifecycle-node lifecycle-node--end">
        <span className="lifecycle-node__pin" aria-hidden />
        <div className="lifecycle-node__body">
          <span className="lifecycle-node__eyebrow">{COPY.endHint[lang]}</span>
          <span className="lifecycle-node__title">{COPY.end[lang]}</span>
        </div>
      </div>
    </div>
  );
}

function LifecycleWeek({
  week,
  tone,
  isLast,
  lang,
}: {
  week: FlowchartData["weeks"][number];
  tone: "from" | "via" | "to" | "ink";
  isLast: boolean;
  lang: "de" | "en";
}) {
  const rows: Array<{ key: "action" | "test" | "metric"; text: string }> = [];
  if (week.action) rows.push({ key: "action", text: week.action });
  if (week.test) rows.push({ key: "test", text: week.test });
  if (week.metric) rows.push({ key: "metric", text: week.metric });
  const fallback = rows.length === 0 && week.headline ? week.headline : null;

  return (
    <div
      className={`lifecycle-week lifecycle-week--${tone}${
        isLast ? " lifecycle-week--last" : ""
      }`}
    >
      <div className="lifecycle-week__pin" aria-hidden>
        <span className="lifecycle-week__pin-index">{week.index}</span>
      </div>
      <div className="lifecycle-week__card">
        <div className="lifecycle-week__label">{week.label}</div>
        {fallback ? (
          <p className="lifecycle-week__fallback">{fallback}</p>
        ) : (
          <ul className="lifecycle-week__rows">
            {rows.map((row) => (
              <li key={row.key} className={`lifecycle-row lifecycle-row--${row.key}`}>
                <span className="lifecycle-row__label">
                  {SUBLINE[row.key][lang]}
                </span>
                <span className="lifecycle-row__text">{row.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LifecycleGate({
  gate,
  lang,
}: {
  gate: Gate;
  lang: "de" | "en";
}) {
  const dayLabel = gate.label;
  return (
    <div className="lifecycle-gate">
      <div className="lifecycle-gate__diamond" aria-hidden>
        <div className="lifecycle-gate__diamond-inner">
          <span className="lifecycle-gate__day">{dayLabel}</span>
        </div>
      </div>
      <div className="lifecycle-gate__body">
        <span className="lifecycle-gate__eyebrow">{COPY.gate[lang]}</span>
        <ul className="lifecycle-gate__paths">
          {gate.decisions.map((decision) => {
            const text =
              decision === "kill"
                ? KILL_TEXT[lang]
                : decision === "pivot"
                  ? PIVOT_TEXT[lang]
                  : DECISION_LABEL.continue[lang];
            return (
              <li
                key={decision}
                className={`lifecycle-path lifecycle-path--${decision}`}
              >
                <span className="lifecycle-path__dot" aria-hidden />
                <span className="lifecycle-path__label">
                  {DECISION_LABEL[decision][lang]}
                </span>
                <span className="lifecycle-path__text">{text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
