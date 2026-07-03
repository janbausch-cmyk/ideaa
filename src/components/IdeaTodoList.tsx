import type { FlowchartData, Gate, GateDecision, WeekStep } from "@/lib/flowchart-parser";

type Props = {
  data: FlowchartData;
  lang: "de" | "en";
};

const COPY = {
  heading: { de: "Umsetzungs-Checkliste", en: "Execution checklist" },
  subhead: {
    de: "Vom Oberziel zu Meilensteinen zu konkreten Maßnahmen — alles auf einem Blick abhakbar.",
    en: "From the top goal down to milestones and concrete actions — one glance, ready to tick off.",
  },
  overarching: { de: "Oberziel", en: "Top goal", // eyebrow label
  },
  overarchingGoal: {
    de: "Idee in 30 Tagen validieren und v0 grün schalten.",
    en: "Validate the idea in 30 days and get v0 to green.",
  },
  milestone: { de: "Meilenstein", en: "Milestone" },
  action: { de: "Aktion", en: "Action" },
  test: { de: "Test", en: "Test" },
  metric: { de: "Metrik", en: "Metric" },
  gate: { de: "Gate", en: "Gate" },
  gateDecide: {
    de: "Am Gate entscheiden",
    en: "Decide at gate",
  },
} as const;

const DECISION_LABEL: Record<GateDecision, Record<"de" | "en", string>> = {
  continue: { de: "Weiter", en: "Continue" },
  pivot: { de: "Pivot", en: "Pivot" },
  kill: { de: "Stopp", en: "Kill" },
};

// Which gate belongs after which week? Day 7 → after Woche 1, Day 14 → after
// Woche 2, Day 21 → after Woche 3, everything ≥Tag 22 (typically Tag 30) →
// after Woche 4.
function gateWeekIndex(day: number): number {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

type Measure = { key: "action" | "test" | "metric"; text: string };

function measuresOf(week: WeekStep): Measure[] {
  const out: Measure[] = [];
  if (week.action) out.push({ key: "action", text: week.action });
  if (week.test) out.push({ key: "test", text: week.test });
  if (week.metric) out.push({ key: "metric", text: week.metric });
  return out;
}

export default function IdeaTodoList({ data, lang }: Props) {
  const gatesByWeek = new Map<number, Gate>();
  for (const gate of data.gates) {
    const wk = gateWeekIndex(gate.day);
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
      className="todo-panel surface-card"
      aria-labelledby="idea-todo-heading"
    >
      <div className="todo-panel__header">
        <h2 id="idea-todo-heading" className="eyebrow">
          {COPY.heading[lang]}
        </h2>
        <p className="todo-panel__subhead">{COPY.subhead[lang]}</p>
      </div>

      <div className="todo-goal" role="group" aria-label={COPY.overarching[lang]}>
        <span className="todo-goal__eyebrow">{COPY.overarching[lang]}</span>
        <p className="todo-goal__text">{COPY.overarchingGoal[lang]}</p>
      </div>

      <ol className="todo-milestones">
        {weeks.map((week, idx) => {
          const gate = gatesByWeek.get(week.index) ?? null;
          const measures = measuresOf(week);
          const isLast = idx === weeks.length - 1;
          return (
            <li key={week.index} className="todo-milestone">
              <div className="todo-milestone__header">
                <span className="todo-milestone__index" aria-hidden>
                  {week.index}
                </span>
                <div className="todo-milestone__title-block">
                  <span className="todo-milestone__eyebrow">
                    {COPY.milestone[lang]} {week.index} · {week.label}
                  </span>
                  {week.headline ? (
                    <span className="todo-milestone__headline">
                      {week.headline}
                    </span>
                  ) : null}
                </div>
              </div>

              {measures.length > 0 ? (
                <ul className="todo-measures">
                  {measures.map((m) => (
                    <li
                      key={m.key}
                      className={`todo-measure todo-measure--${m.key}`}
                    >
                      <span className="todo-checkbox" aria-hidden />
                      <span className="todo-measure__label">
                        {COPY[m.key][lang]}
                      </span>
                      <span className="todo-measure__text">{m.text}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {gate ? (
                <GateCard gate={gate} lang={lang} lastMilestone={isLast} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function GateCard({
  gate,
  lang,
  lastMilestone,
}: {
  gate: Gate;
  lang: "de" | "en";
  lastMilestone: boolean;
}) {
  return (
    <div
      className={`todo-gate${lastMilestone ? " todo-gate--final" : ""}`}
      role="group"
      aria-label={`${COPY.gate[lang]} ${gate.label}`}
    >
      <div className="todo-gate__header">
        <span className="todo-gate__badge">{gate.label}</span>
        <span className="todo-gate__eyebrow">{COPY.gateDecide[lang]}</span>
      </div>
      {gate.summary ? (
        <p className="todo-gate__summary">{gate.summary}</p>
      ) : null}
      <ul className="todo-gate__decisions">
        {gate.decisions.map((decision) => (
          <li
            key={decision}
            className={`todo-decision todo-decision--${decision}`}
          >
            <span className="todo-decision__dot" aria-hidden />
            <span className="todo-decision__label">
              {DECISION_LABEL[decision][lang]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
