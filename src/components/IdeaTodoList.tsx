import type {
  FlowchartData,
  Gate,
  GateDecision,
  Milestone,
} from "@/lib/flowchart-parser";

type Props = {
  data: FlowchartData;
  lang: "de" | "en";
};

const COPY = {
  heading: { de: "Umsetzungs-Checkliste", en: "Execution checklist" },
  subhead: {
    de: "Vom Oberziel zu Meilensteinen zu konkreten Maßnahmen, alles auf einem Blick abhakbar.",
    en: "From the top goal down to milestones and concrete actions, one glance, ready to tick off.",
  },
  overarching: { de: "Oberziel", en: "Top goal" },
  overarchingFallback: {
    de: "Idee in 90 Tagen validieren, zahlende Kunden oder klaren Abbruch.",
    en: "Validate the idea in 90 days: paying customers or a clean kill.",
  },
  outcomeLabel: { de: "Ziel", en: "Outcome" },
  gateDecide: { de: "Am Gate entscheiden", en: "Decide at gate" },
} as const;

const DECISION_LABEL: Record<GateDecision, Record<"de" | "en", string>> = {
  continue: { de: "Weiter", en: "Continue" },
  pivot: { de: "Pivot", en: "Pivot" },
  kill: { de: "Stopp", en: "Kill" },
};

export default function IdeaTodoList({ data, lang }: Props) {
  const goal = data.goal.trim() || COPY.overarchingFallback[lang];
  const milestones = data.milestones;

  if (milestones.length === 0) return null;

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

      <div
        className="todo-goal"
        role="group"
        aria-label={COPY.overarching[lang]}
      >
        <span className="todo-goal__eyebrow">{COPY.overarching[lang]}</span>
        <p className="todo-goal__text">{goal}</p>
      </div>

      <ol className="todo-milestones">
        {milestones.map((milestone, idx) => (
          <MilestoneCard
            key={milestone.index}
            milestone={milestone}
            lang={lang}
            isLast={idx === milestones.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

function MilestoneCard({
  milestone,
  lang,
  isLast,
}: {
  milestone: Milestone;
  lang: "de" | "en";
  isLast: boolean;
}) {
  return (
    <li className="todo-milestone">
      <div className="todo-milestone__header">
        <span className="todo-milestone__index" aria-hidden>
          {milestone.index}
        </span>
        <div className="todo-milestone__title-block">
          <span className="todo-milestone__eyebrow">{milestone.label}</span>
          {milestone.title ? (
            <span className="todo-milestone__headline">{milestone.title}</span>
          ) : null}
          {milestone.outcome ? (
            <span className="todo-milestone__outcome">
              <span className="todo-milestone__outcome-label">
                {COPY.outcomeLabel[lang]}:
              </span>{" "}
              {milestone.outcome}
            </span>
          ) : null}
        </div>
      </div>

      {milestone.todos.length > 0 ? (
        <ul className="todo-measures">
          {milestone.todos.map((todo, i) => (
            <li key={i} className="todo-measure todo-measure--todo">
              <span className="todo-checkbox" aria-hidden />
              <span className="todo-measure__text">{todo}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {milestone.gate ? (
        <GateCard gate={milestone.gate} lang={lang} lastMilestone={isLast} />
      ) : null}
    </li>
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
      aria-label={`Gate ${gate.label}`}
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
