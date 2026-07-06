// Parser for §8 (Umsetzungs-Plan / Execution plan) and §9 (Decision gates) of
// the analysis report. Feeds the "Umsetzungs-Checkliste" UI component.
//
// Two formats are supported:
//
//   New format (post 2026-07-06, IDEAA-165 v2):
//     ## 8. Umsetzungs-Plan (30 / 60 / 90 Tage)
//     **Oberziel (bis Tag 90):** …
//     ### M1 · Tag 1–7 · <title>
//     **Outcome:** …
//     - [ ] todo
//     **Gate Tag 7:** …
//     ### M2 · Tag 8–14 · <title>
//     …
//
//   Legacy format (pre IDEAA-165 v2, 4-week structure):
//     ## 8. 30-Tage-Validierungsplan
//     - **Woche 1.** Aktion: … Test: … Erfolg: …
//     - **Woche 2.** …
//
// Multilingual: the LLM translates section headings into the input language
// (DE, EN, NL, ES, FR) but is instructed to keep the M<n> · Tag <from>–<to>
// skeleton verbatim so the parser matches across all languages.

export type GateDecision = "kill" | "pivot" | "continue";

export type Gate = {
  day: number;                 // 7, 14, 30, 60, 90 etc.
  label: string;               // e.g. "Tag 7"
  summary: string;             // trimmed bullet body
  decisions: GateDecision[];   // detected paths
};

export type Milestone = {
  index: number;               // 1..9 (or 1..N in legacy)
  label: string;               // e.g. "M1 · Tag 1–7"
  title: string;               // short milestone title
  outcome: string;             // one-line outcome (may be empty on legacy)
  todos: string[];             // checkable action items
  gate: Gate | null;           // optional inline gate at the end
};

export type FlowchartData = {
  goal: string;                // "Oberziel" sentence (may be "" on legacy)
  milestones: Milestone[];
  gates: Gate[];               // §9 gates, redundant to inline gates but useful
};

// Section-heading patterns for §8 and §9. Multilingual heading-text fallbacks
// so the parser works even if the LLM localised the heading label.
const SECTION_8_PATTERNS: RegExp[] = [
  /(^|\n)#{1,3}\s*8[.)]\s.*$/im,
  /(^|\n)#{1,3}\s*(?:Umsetzungs[- ]?Plan|Execution plan|30-Tage[- ]Validierungsplan|30-day validation plan|Plan de ejecuci[oó]n|Plan d['’]ex[eé]cution|Uitvoeringsplan)/im,
];
const SECTION_9_PATTERNS: RegExp[] = [
  /(^|\n)#{1,3}\s*9[.)]\s.*$/im,
  /(^|\n)#{1,3}\s*(?:Entscheidungs[- ]Gates|Decision gates|Beslispunten|Puntos de decisi[oó]n|Points de d[eé]cision)/im,
];

function findSection(markdown: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const match = re.exec(markdown);
    if (!match || match.index === undefined) continue;
    const startOfLine = match.index + (match[1] === "\n" ? 1 : 0);
    const afterHeading = markdown.indexOf("\n", startOfLine);
    if (afterHeading === -1) continue;
    const rest = markdown.slice(afterHeading + 1);
    // Section ends at the next `## N.` top-level heading.
    const nextHeading = /\n#{1,2}\s*\d+[.)]\s/.exec(rest);
    const body = nextHeading ? rest.slice(0, nextHeading.index) : rest;
    const trimmed = body.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

// ── §8 new format ───────────────────────────────────────────────────────────

// Matches: `### M1 · Tag 1–7 · Wedge validation via interviews`
// Tolerates ##/### prefix, either dot type (·, •, ・), en-dash or hyphen in the
// day range, optional trailing punctuation.
const MILESTONE_HEADING_RE =
  /(^|\n)#{2,4}\s*M\s*(\d+)\s*[·•・:.\-]\s*(?:Tag|Day|Dag|D[ií]a|Jour)\s*(\d+)\s*[–\-]\s*(\d+)\s*[·•・:.\-]\s*(.+?)\s*$/gim;

// Matches a top-goal line at the start of §8.
const TOP_GOAL_PATTERNS: RegExp[] = [
  /^\s*\*\*\s*(?:Oberziel|Top goal|Objetivo principal|Objectif principal|Hoofddoel)[^*]*\*\*\s*:?\s*(.+?)\s*$/im,
  /^\s*(?:Oberziel|Top goal|Objetivo principal|Objectif principal|Hoofddoel)[^:]*:\s*(.+?)\s*$/im,
];

// Matches: **Outcome:** …, **Ergebnis:** …, etc. Also tolerates missing bold.
const OUTCOME_MARKER =
  /^\s*(?:\*\*)?\s*(?:Outcome|Ergebnis|Ziel|Resultado|Résultat|Uitkomst)\s*(?:\*\*)?\s*:\s*(.+)$/i;

// Matches an inline gate line: **Gate Tag 7:** … or Gate Day 14: …
const INLINE_GATE_RE =
  /^\s*(?:\*\*)?\s*Gate\s+(?:Tag|Day|Dag|D[ií]a|Jour)\s+(\d+)\s*(?:\*\*)?\s*:\s*(.+)$/i;

// Matches a checkbox todo line: `- [ ] text` or `* [ ] text`. Tolerates
// checked boxes so partially-completed lists don't disappear.
const TODO_LINE_RE = /^\s*[-*]\s*\[[ xX]\]\s+(.+?)\s*$/;

function extractTopGoal(body: string): string {
  const firstBlock = body.split(/\n\s*\n/, 1)[0] ?? "";
  for (const re of TOP_GOAL_PATTERNS) {
    const m = re.exec(firstBlock);
    if (m && m[1]) return m[1].trim();
  }
  // No explicit "Oberziel"/"Top goal" marker — leave empty, the UI has a
  // language-aware fallback. Guessing from the first sentence risks picking
  // up a week-1 bullet as the top goal (see legacy reports).
  return "";
}

function extractMilestonesNew(body: string): Milestone[] {
  const heads: Array<{
    idx: number;
    end: number;
    n: number;
    from: number;
    to: number;
    title: string;
    label: string;
  }> = [];

  MILESTONE_HEADING_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MILESTONE_HEADING_RE.exec(body)) !== null) {
    const n = Number(m[2]);
    const from = Number(m[3]);
    const to = Number(m[4]);
    const title = m[5].trim();
    if (!Number.isFinite(n) || n < 1 || n > 20) continue;
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    const startOfLine = m.index + (m[1] === "\n" ? 1 : 0);
    heads.push({
      idx: startOfLine,
      end: 0,
      n,
      from,
      to,
      title,
      label: `M${n} · Tag ${from}–${to}`,
    });
  }
  if (heads.length === 0) return [];

  for (let i = 0; i < heads.length; i++) {
    heads[i].end = i + 1 < heads.length ? heads[i + 1].idx : body.length;
  }

  const seen = new Set<number>();
  const out: Milestone[] = [];
  for (const head of heads) {
    if (seen.has(head.n)) continue;
    seen.add(head.n);
    const chunk = body.slice(head.idx, head.end);
    const lines = chunk.split("\n").slice(1); // drop the heading line itself
    let outcome = "";
    const todos: string[] = [];
    let inlineGate: Gate | null = null;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (!outcome) {
        const om = OUTCOME_MARKER.exec(line);
        if (om) {
          outcome = om[1].trim().replace(/\*\*/g, "");
          continue;
        }
      }
      const todoMatch = TODO_LINE_RE.exec(line);
      if (todoMatch) {
        todos.push(cleanTodoText(todoMatch[1]));
        continue;
      }
      const gateMatch = INLINE_GATE_RE.exec(line);
      if (gateMatch) {
        const day = Number(gateMatch[1]);
        const summary = gateMatch[2].trim().replace(/\*\*/g, "");
        inlineGate = {
          day,
          label: `Tag ${day}`,
          summary: truncate(summary, 240),
          decisions: detectDecisions(summary),
        };
        continue;
      }
    }
    if (todos.length === 0 && !outcome) continue;
    out.push({
      index: head.n,
      label: head.label,
      title: head.title,
      outcome,
      todos,
      gate: inlineGate,
    });
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

function cleanTodoText(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

// ── §8 legacy 4-week fallback ──────────────────────────────────────────────

const LEGACY_WEEK_HEADING_RE =
  /(^|\n)(?:[-*]\s*)?\*\*\s*(Woche|Week|Semana|Semaine|Weekje?)\s*(\d+)[^*]*\*\*\s*([\s\S]*?)(?=(?:\n(?:[-*]\s*)?\*\*\s*(?:Woche|Week|Semana|Semaine|Weekje?)\s*\d+)|$)/gi;

const TEST_MARKER = /\b(?:Test|Prueba|Testen)\s*:\s*/i;
const METRIC_MARKER =
  /\b(?:Success|Erfolg(?:smetrik)?|Metrik|Metric|M[eé]trica|R[eé]ussite|Succ[eè]s|Zielmetrik)\s*:\s*/i;
const FAILURE_MARKER =
  /\b(?:Failure|Misserfolg|Fehler|Fracaso|Kill|Abbruch|Stopp?|[EÉé]chec)\s*:\s*/i;

function extractMilestonesLegacy(body: string): Milestone[] {
  const out: Milestone[] = [];
  const seen = new Set<number>();
  LEGACY_WEEK_HEADING_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LEGACY_WEEK_HEADING_RE.exec(body)) !== null) {
    const noun = m[2];
    const idx = Number(m[3]);
    if (!Number.isFinite(idx) || idx < 1 || idx > 12) continue;
    if (seen.has(idx)) continue;
    seen.add(idx);
    const cleaned = cleanBulletBody(m[4]);
    const parts = splitLegacyWeekParts(cleaned);
    const dayFrom = (idx - 1) * 7 + 1;
    // Legacy reports were "4 weeks = 30 days" — the last week runs to day 30,
    // not day 28, so the Tag-30 §9-gate attaches correctly.
    const dayTo = idx === 4 ? 30 : idx * 7;
    const stripActionPrefix = (s: string) =>
      s.replace(/^\s*(?:Aktion|Action|Acci[oó]n|Handeling|Handlung)\s*:\s*/i, "");
    const todos: string[] = [];
    if (parts.action)
      todos.push(`Aktion: ${stripActionPrefix(parts.action)}`);
    if (parts.test) todos.push(`Test: ${parts.test}`);
    if (parts.metric) todos.push(`Erfolg: ${parts.metric}`);
    if (todos.length === 0 && cleaned) todos.push(truncate(cleaned, 200));
    out.push({
      index: idx,
      label: `M${idx} · Tag ${dayFrom}–${dayTo}`,
      title: `${noun} ${idx}`,
      outcome: "",
      todos,
      gate: null,
    });
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

function splitLegacyWeekParts(clean: string): {
  action?: string;
  test?: string;
  metric?: string;
} {
  const testM = TEST_MARKER.exec(clean);
  const metricM = METRIC_MARKER.exec(clean);
  const failureM = FAILURE_MARKER.exec(clean);
  const trimEnd = (s: string) => s.replace(/[\s.,;:—–\-]+$/, "").trim();
  let action: string | undefined;
  let test: string | undefined;
  let metric: string | undefined;
  if (testM) {
    action = trimEnd(clean.slice(0, testM.index));
    const testStart = testM.index + testM[0].length;
    const testEnd =
      metricM && metricM.index > testM.index
        ? metricM.index
        : failureM && failureM.index > testM.index
          ? failureM.index
          : clean.length;
    test = trimEnd(clean.slice(testStart, testEnd));
  }
  if (metricM) {
    if (!testM) action = trimEnd(clean.slice(0, metricM.index));
    const metricStart = metricM.index + metricM[0].length;
    const metricEnd =
      failureM && failureM.index > metricM.index
        ? failureM.index
        : clean.length;
    metric = trimEnd(clean.slice(metricStart, metricEnd));
  }
  const t = (s: string | undefined) =>
    s && s.length > 0 ? truncate(s, 220) : undefined;
  return { action: t(action), test: t(test), metric: t(metric) };
}

// ── §9 gate extraction ─────────────────────────────────────────────────────

function extractGates(body: string): Gate[] {
  const gateRe =
    /(^|\n)[\-*]\s*[*_]{1,2}\s*(Day|Tag|Dag|D[ií]a|Jour)\s*(\d+)\s*[.:*_]*\s*[*_]{0,2}\s*([\s\S]*?)(?=(?:\n[\-*]\s*[*_]{1,2}\s*(?:Day|Tag|Dag|D[ií]a|Jour)\s*\d+)|$)/gi;
  const gates: Gate[] = [];
  const seen = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = gateRe.exec(body)) !== null) {
    const day = Number(m[3]);
    if (!Number.isFinite(day) || day < 1 || day > 365) continue;
    if (seen.has(day)) continue;
    seen.add(day);
    const rawBody = m[4];
    const summary = truncate(cleanBulletBody(rawBody), 260);
    gates.push({
      day,
      label: `${m[2]} ${day}`,
      summary,
      decisions: detectDecisions(rawBody),
    });
  }
  gates.sort((a, b) => a.day - b.day);
  return gates;
}

const CONTINUE_WORDS = [
  "continue", "green-light", "green light", "greenlight", "go", "proceed",
  "ship", "grün", "gruen", "weiter", "weitermachen", "fortsetzen", "doorgaan",
  "groen licht", "continuar", "seguir", "continuer", "poursuivre",
];
const PIVOT_WORDS = ["pivot", "pivotieren", "pivoteren", "pivotar", "pivoter"];
const KILL_WORDS = [
  "kill", "abort", "stop", "abbrechen", "einstellen", "abbruch", "stoppen",
  "matar", "cancelar", "abandonar", "arrêter", "arreter", "abandonner",
];

function detectDecisions(text: string): GateDecision[] {
  const lower = text.toLowerCase();
  const out: GateDecision[] = [];
  if (CONTINUE_WORDS.some((w) => containsWord(lower, w))) out.push("continue");
  if (PIVOT_WORDS.some((w) => containsWord(lower, w))) out.push("pivot");
  if (KILL_WORDS.some((w) => containsWord(lower, w))) out.push("kill");
  if (out.length === 0) out.push("continue");
  return out;
}

function containsWord(hay: string, needle: string): boolean {
  if (needle.includes(" ") || needle.includes("-")) {
    return hay.includes(needle);
  }
  const re = new RegExp(`\\b${escapeRegExp(needle)}`, "i");
  return re.test(hay);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanBulletBody(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s.:—–\-]+/, "")
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return safe.replace(/[,;:.\s]+$/, "") + "…";
}

// Merge §9 gates into inline milestone gates so the UI has one source of
// truth. If a milestone already has an inline gate, it wins. Otherwise the
// §9 gate whose `day` falls into the milestone's Tag range is attached.
function attachSectionGates(
  milestones: Milestone[],
  gates: Gate[],
): Milestone[] {
  if (gates.length === 0) return milestones;
  return milestones.map((ms) => {
    if (ms.gate) return ms;
    const m = /Tag\s+(\d+)\s*[–\-]\s*(\d+)/i.exec(ms.label);
    if (!m) return ms;
    const from = Number(m[1]);
    const to = Number(m[2]);
    const g = gates.find((x) => x.day >= from && x.day <= to);
    return g ? { ...ms, gate: g } : ms;
  });
}

export function parseFlowchart(planMarkdown: string): FlowchartData | null {
  const section8 = findSection(planMarkdown, SECTION_8_PATTERNS);
  const section9 = findSection(planMarkdown, SECTION_9_PATTERNS);
  if (!section8 && !section9) return null;

  const goal = section8 ? extractTopGoal(section8) : "";
  const newMilestones = section8 ? extractMilestonesNew(section8) : [];
  const legacyMilestones =
    newMilestones.length === 0 && section8
      ? extractMilestonesLegacy(section8)
      : [];
  const gates = section9 ? extractGates(section9) : [];

  const milestones = attachSectionGates(
    newMilestones.length > 0 ? newMilestones : legacyMilestones,
    gates,
  );

  if (milestones.length === 0 && gates.length === 0) return null;
  return { goal, milestones, gates };
}
