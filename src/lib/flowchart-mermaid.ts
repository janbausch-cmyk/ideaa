import type {
  FlowchartData,
  Gate,
  GateDecision,
  WeekStep,
} from "./flowchart-parser";

// Convert a parsed §8/§9 shape into a Mermaid `flowchart LR` definition.
//
// Layout is a value-stream style pipeline: each week is a swim-lane subgraph
// containing one process card (Aktion / Test / Metrik as sub-lines). Gates
// sit between weeks as rhombuses. Edges are colour-coded — brand-purple for
// the main flow, green for "continue", amber (dashed) for "pivot", red
// (dashed) for "kill".

const DECISION_LABEL: Record<GateDecision, Record<"de" | "en", string>> = {
  continue: { de: "Weiter", en: "Continue" },
  pivot: { de: "Pivot", en: "Pivot" },
  kill: { de: "Kill", en: "Kill" },
};

const KILL_LABEL: Record<"de" | "en", string> = {
  de: "Idee stoppen",
  en: "Kill idea",
};
const PIVOT_LABEL: Record<"de" | "en", string> = {
  de: "Wedge pivotieren",
  en: "Pivot wedge",
};
const GO_LABEL: Record<"de" | "en", string> = {
  de: "Grünes Licht: v0 bauen",
  en: "Green light: build v0",
};
const START_LABEL: Record<"de" | "en", string> = {
  de: "Start: Validierung",
  en: "Start: Validation",
};
const SUBLINE_LABEL: Record<"action" | "test" | "metric", Record<"de" | "en", string>> = {
  action: { de: "Aktion", en: "Action" },
  test: { de: "Test", en: "Test" },
  metric: { de: "Metrik", en: "Metric" },
};

export type MermaidLang = "de" | "en";

function esc(text: string): string {
  // Preserve `<` and `>` inside labels (e.g. `>=10%`, `->`) as HTML entities so
  // Mermaid's htmlLabels renderer displays them but does not treat them as
  // tags. Quotes are converted to safe alternates so the Mermaid label
  // delimiter isn't broken.
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "'")
    .replace(/\n+/g, " ")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim();
}

// Which week does each gate day sit AFTER? Day 7 → after week 1, Day 14 →
// after week 2, Day 21 → after week 3, Day 30 → after week 4.
function gateAfterWeek(day: number): number {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

// Edge stroke styles applied via `linkStyle <idx> ...`. Colours come from the
// site brand palette and traffic-light semantics.
const BRAND_EDGE = "stroke:#8b5cf6,stroke-width:2.5px,fill:none";
const CONTINUE_EDGE = "stroke:#16a34a,stroke-width:2.5px,fill:none";
const PIVOT_EDGE =
  "stroke:#ca8a04,stroke-width:2px,stroke-dasharray:6 3,fill:none";
const KILL_EDGE =
  "stroke:#dc2626,stroke-width:2px,stroke-dasharray:6 3,fill:none";

export function buildMermaidDefinition(
  data: FlowchartData,
  lang: MermaidLang = "de",
): string {
  const lines: string[] = ["flowchart LR"];
  const linkStyles: string[] = [];
  let edgeIdx = 0;

  const addEdge = (line: string, style: string) => {
    lines.push(`  ${line}`);
    linkStyles.push(`  linkStyle ${edgeIdx} ${style}`);
    edgeIdx += 1;
  };

  lines.push(`  START(["${esc(START_LABEL[lang])}"]):::start`);

  let prevNode = "START";
  let pendingContinueLabel: string | null = null;

  const gatesByWeek = new Map<number, Gate>();
  for (const gate of data.gates) {
    const wk = gateAfterWeek(gate.day);
    if (!gatesByWeek.has(wk)) gatesByWeek.set(wk, gate);
  }

  const weeksToRender: WeekStep[] =
    data.weeks.length > 0
      ? data.weeks
      : Array.from(gatesByWeek.keys())
          .sort((a, b) => a - b)
          .map((idx) => ({
            index: idx,
            label: lang === "de" ? `Woche ${idx}` : `Week ${idx}`,
            headline: "",
          }));

  const HD_ACTION = SUBLINE_LABEL.action[lang];
  const HD_TEST = SUBLINE_LABEL.test[lang];
  const HD_METRIC = SUBLINE_LABEL.metric[lang];

  for (const week of weeksToRender) {
    const nodeId = `W${week.index}`;
    const subId = `SW${week.index}`;

    const parts: string[] = [];
    if (week.action)
      parts.push(`<b>${esc(HD_ACTION)}</b><br/>${esc(week.action)}`);
    if (week.test)
      parts.push(`<b>${esc(HD_TEST)}</b><br/>${esc(week.test)}`);
    if (week.metric)
      parts.push(`<b>${esc(HD_METRIC)}</b><br/>${esc(week.metric)}`);
    const cardBody =
      parts.length > 0 ? parts.join("<br/><br/>") : esc(week.headline || week.label);

    // Each week is its own subgraph so the SVG shows a labelled swim-lane
    // around the process card.
    lines.push(`  subgraph ${subId} ["${esc(week.label)}"]`);
    lines.push(`    direction TB`);
    lines.push(`    ${nodeId}["${cardBody}"]:::week`);
    lines.push(`  end`);

    if (pendingContinueLabel) {
      addEdge(`${prevNode} -->|${esc(pendingContinueLabel)}| ${nodeId}`, CONTINUE_EDGE);
      pendingContinueLabel = null;
    } else {
      addEdge(`${prevNode} --> ${nodeId}`, BRAND_EDGE);
    }
    prevNode = nodeId;

    const gate = gatesByWeek.get(week.index);
    if (gate) {
      const gateId = `G${gate.day}`;
      lines.push(`  ${gateId}{"${esc(gate.label)}"}:::gate`);
      addEdge(`${prevNode} --> ${gateId}`, BRAND_EDGE);

      for (const decision of gate.decisions) {
        const decisionLabel = DECISION_LABEL[decision][lang];
        if (decision === "continue") {
          // Attach the "Weiter" label to the next linear edge (either the
          // following week or the terminal green-light node).
          pendingContinueLabel = decisionLabel;
        } else {
          const outcomeId = `${gateId}_${decision.toUpperCase()}`;
          const outcomeLabel =
            decision === "kill" ? KILL_LABEL[lang] : PIVOT_LABEL[lang];
          lines.push(
            `  ${outcomeId}(["${esc(outcomeLabel)}"]):::outcome_${decision}`,
          );
          const style = decision === "kill" ? KILL_EDGE : PIVOT_EDGE;
          addEdge(
            `${gateId} -->|${esc(decisionLabel)}| ${outcomeId}`,
            style,
          );
        }
      }
      prevNode = gateId;
    }
  }

  // Emit the terminal "green light" node unless the last gate is Day 30
  // AND it already produced a continue arm that we drew above (rare — we
  // still want a visible endpoint, so always synthesize it if a continue
  // is pending).
  const finalGate = data.gates[data.gates.length - 1];
  const needTerminal = !finalGate || finalGate.day < 21 || pendingContinueLabel;
  if (needTerminal) {
    lines.push(`  END(["${esc(GO_LABEL[lang])}"]):::outcome_continue`);
    if (pendingContinueLabel) {
      addEdge(
        `${prevNode} -->|${esc(pendingContinueLabel)}| END`,
        CONTINUE_EDGE,
      );
    } else {
      addEdge(`${prevNode} --> END`, CONTINUE_EDGE);
    }
  }

  // Node style palette. Weeks pick up the brand purple, gates the amber
  // "decision" tone, outcomes the three traffic-light colours. Colours mirror
  // the light-mode brand tokens in globals.css — Mermaid can't read CSS vars
  // under strict security so we inline the hex values here.
  lines.push(
    "  classDef start fill:#f5f3ff,stroke:#6366f1,color:#312e81,stroke-width:2px,font-weight:600",
  );
  lines.push(
    "  classDef week fill:#ffffff,stroke:#8b5cf6,color:#1e1b4b,stroke-width:1.5px,padding:16px",
  );
  lines.push(
    "  classDef gate fill:#fef3c7,stroke:#b45309,color:#78350f,stroke-width:2px,font-weight:600",
  );
  lines.push(
    "  classDef outcome_continue fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px,font-weight:600",
  );
  lines.push(
    "  classDef outcome_pivot fill:#fef9c3,stroke:#ca8a04,color:#713f12,stroke-width:2px,font-weight:600",
  );
  lines.push(
    "  classDef outcome_kill fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-width:2px,font-weight:600",
  );
  lines.push(...linkStyles);

  return lines.join("\n");
}
