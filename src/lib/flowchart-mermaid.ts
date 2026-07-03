import type { FlowchartData, Gate, GateDecision } from "./flowchart-parser";

// Convert a parsed §8/§9 shape into a Mermaid `flowchart TD` definition.
// The diagram threads Week 1 → optional Day-7 gate → Week 2 → Day-14 →
// Week 3 → Week 4 → Day-30 gate, with kill/pivot/continue branches coloured
// green/yellow/red. Any missing weeks or gates are skipped gracefully.

const DECISION_LABEL: Record<GateDecision, Record<"de" | "en", string>> = {
  continue: { de: "Weiter", en: "Continue" },
  pivot: { de: "Pivot", en: "Pivot" },
  kill: { de: "Kill", en: "Kill" },
};

const KILL_LABEL: Record<"de" | "en", string> = { de: "Idee stoppen", en: "Kill idea" };
const PIVOT_LABEL: Record<"de" | "en", string> = { de: "Wedge pivotieren", en: "Pivot wedge" };
const GO_LABEL: Record<"de" | "en", string> = {
  de: "Grünes Licht: v0 bauen",
  en: "Green light: build v0",
};

export type MermaidLang = "de" | "en";

function esc(text: string): string {
  return text
    .replace(/"/g, "'")
    .replace(/\n+/g, " ")
    .replace(/[<>]/g, "")
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

export function buildMermaidDefinition(
  data: FlowchartData,
  lang: MermaidLang = "de",
): string {
  const lines: string[] = ["flowchart TD"];
  const classes: string[] = [];

  const startLabel = lang === "de" ? "Start: Validierung" : "Start: Validation";
  lines.push(`  START(["${esc(startLabel)}"])`);
  classes.push("class START start");

  let prevNode = "START";
  const gatesByWeek = new Map<number, Gate>();
  for (const gate of data.gates) {
    const wk = gateAfterWeek(gate.day);
    // If two gates map to the same week (rare), keep the earliest.
    if (!gatesByWeek.has(wk)) gatesByWeek.set(wk, gate);
  }

  const weeksToRender = data.weeks.length > 0
    ? data.weeks
    : // If §8 is missing but §9 exists, emit synthetic week stubs so the gates
      // still have anchors.
      Array.from(gatesByWeek.keys())
        .sort((a, b) => a - b)
        .map((idx) => ({
          index: idx,
          label: lang === "de" ? `Woche ${idx}` : `Week ${idx}`,
          headline: "",
        }));

  for (const week of weeksToRender) {
    const nodeId = `W${week.index}`;
    const headline = week.headline
      ? `${week.label}: ${week.headline}`
      : week.label;
    lines.push(`  ${nodeId}["${esc(headline)}"]`);
    classes.push(`class ${nodeId} week`);
    lines.push(`  ${prevNode} --> ${nodeId}`);
    prevNode = nodeId;

    const gate = gatesByWeek.get(week.index);
    if (gate) {
      const gateId = `G${gate.day}`;
      lines.push(`  ${gateId}{"${esc(`${gate.label}?`)}"}`);
      classes.push(`class ${gateId} gate`);
      lines.push(`  ${prevNode} --> ${gateId}`);
      // Emit terminal branches. Each unique decision gets its own outcome node.
      for (const decision of gate.decisions) {
        const label = DECISION_LABEL[decision][lang];
        const outcomeId = `${gateId}_${decision.toUpperCase()}`;
        const outcomeLabel =
          decision === "kill"
            ? KILL_LABEL[lang]
            : decision === "pivot"
              ? PIVOT_LABEL[lang]
              : lang === "de"
                ? "Weiter zur nächsten Woche"
                : "Move to next week";
        // Non-continue branches terminate. Continue branches also terminate
        // per-gate so the diagram stays acyclic; the main path picks up at the
        // next week node via the sequential --> emitted above.
        const shape =
          decision === "continue"
            ? `["${esc(outcomeLabel)}"]`
            : decision === "kill"
              ? `(["${esc(outcomeLabel)}"])`
              : `(["${esc(outcomeLabel)}"])`;
        lines.push(`  ${outcomeId}${shape}`);
        classes.push(`class ${outcomeId} outcome_${decision}`);
        lines.push(`  ${gateId} -->|${esc(label)}| ${outcomeId}`);
      }
      // Continue the linear flow from the gate itself into the next week.
      prevNode = gateId;
    }
  }

  // Terminal "green light" node at the end of the last week (if no Day-30
  // gate already produced one).
  const finalGate = data.gates[data.gates.length - 1];
  if (!finalGate || finalGate.day < 21) {
    lines.push(`  END(["${esc(GO_LABEL[lang])}"])`);
    lines.push(`  ${prevNode} --> END`);
    classes.push("class END outcome_continue");
  }

  // Colour classes. Mermaid classDef syntax: classDef <name> fill:...,stroke:...
  lines.push(
    "  classDef start fill:#e0f2fe,stroke:#0369a1,color:#0c4a6e,stroke-width:2px",
  );
  lines.push(
    "  classDef week fill:#f8fafc,stroke:#334155,color:#0f172a,stroke-width:1.5px",
  );
  lines.push(
    "  classDef gate fill:#fef3c7,stroke:#b45309,color:#78350f,stroke-width:2px",
  );
  lines.push(
    "  classDef outcome_continue fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px",
  );
  lines.push(
    "  classDef outcome_pivot fill:#fef9c3,stroke:#ca8a04,color:#713f12,stroke-width:2px",
  );
  lines.push(
    "  classDef outcome_kill fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-width:2px",
  );
  lines.push(...classes);

  return lines.join("\n");
}
