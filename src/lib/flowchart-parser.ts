// Parser for §8 (30-day plan) and §9 (Decision gates) sections of the
// analysis report. Returns a structured shape the Mermaid generator can consume.
//
// Deliberately multilingual: the prompt tells the LLM to translate headings
// and week/day labels into the input language (DE, NL, ES, FR, EN). We match
// week/day numerals directly, so labels like "Woche 1", "Semana 2",
// "Semaine 3", "Dag 14" all work with a single regex family.

export type WeekStep = {
  index: number; // 1..4
  label: string; // e.g. "Woche 1"
  headline: string; // combined headline for callers that just want a summary
  action?: string; // Aktion / Action sub-line (before "Test:")
  test?: string; // Test sub-line
  metric?: string; // Success/Metrik sub-line
};

export type GateDecision = "kill" | "pivot" | "continue";

export type Gate = {
  day: number; // 7, 14, 30 etc.
  label: string; // e.g. "Tag 7"
  summary: string; // trimmed bullet body
  decisions: GateDecision[]; // detected paths (any subset of kill/pivot/continue)
};

export type FlowchartData = {
  weeks: WeekStep[];
  gates: Gate[];
};

// Section-heading patterns for §8 and §9. Tolerates ##/### prefixes and
// `8.` / `8)` numeric separators plus a multilingual text fallback.
const SECTION_8_PATTERNS: RegExp[] = [
  /(^|\n)#{1,3}\s*8[.)]\s.*$/im,
  /(^|\n)#{1,3}\s*(?:30-Tage[- ]Validierungsplan|30-Tage-Plan|30-day validation plan|30 dagen|Plan de validaci[oó]n|Plan de validation)/im,
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
    // Move past the heading line to the section body.
    const afterHeading = markdown.indexOf("\n", startOfLine);
    if (afterHeading === -1) continue;
    const rest = markdown.slice(afterHeading + 1);
    // Section ends at the next top-level "## " heading (any number).
    const nextHeading = /\n#{1,3}\s*\d+[.)]\s/.exec(rest);
    const body = nextHeading ? rest.slice(0, nextHeading.index) : rest;
    const trimmed = body.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

// Extract week bullets from §8 body. Accepts:
//   - **Week 1.** ...
//   - **Woche 1.** ...
//   - **Semana 1:** ...
//   - **Week 1** ...
// The bullet body continues until the next `- **Week N` marker or end.
function extractWeeks(body: string): WeekStep[] {
  const weekRe =
    /(^|\n)[\-*]\s*\*\*\s*([A-Za-zÀ-ÿ]+)\s*(\d+)\s*[.:*]*\s*\*\*\s*([\s\S]*?)(?=(?:\n[\-*]\s*\*\*\s*[A-Za-zÀ-ÿ]+\s*\d+)|$)/g;
  const weeks: WeekStep[] = [];
  const seen = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = weekRe.exec(body)) !== null) {
    const noun = m[2];
    const idx = Number(m[3]);
    if (!Number.isFinite(idx) || idx < 1 || idx > 8) continue;
    // Skip day/gate rows that also start with "**Day N**" inside §8.
    if (/^(day|tag|dag|día|dia|jour)$/i.test(noun)) continue;
    if (seen.has(idx)) continue;
    seen.add(idx);
    const cleaned = cleanBullet(m[4]);
    const parts = splitWeekParts(cleaned);
    const headline = truncate(cleaned, 120);
    weeks.push({
      index: idx,
      label: `${noun} ${idx}`,
      headline,
      action: parts.action,
      test: parts.test,
      metric: parts.metric,
    });
  }
  weeks.sort((a, b) => a.index - b.index);
  return weeks;
}

// Markers used by the LLM prompt for the three sub-fields of a week bullet.
// Kept short and case-insensitive; multilingual variants are covered by
// separate options.
const TEST_MARKER =
  /\b(?:Test|Prueba|Testen)\s*:\s*/i;
const METRIC_MARKER =
  /\b(?:Success|Erfolg(?:smetrik)?|Metrik|Metric|M[eé]trica|R[eé]ussite|Succ[eè]s|Zielmetrik)\s*:\s*/i;
const FAILURE_MARKER =
  /\b(?:Failure|Misserfolg|Fehler|Fracaso|Kill|Abbruch|Stopp?|[EÉé]chec)\s*:\s*/i;

function splitWeekParts(clean: string): {
  action?: string;
  test?: string;
  metric?: string;
} {
  const testM = TEST_MARKER.exec(clean);
  const metricM = METRIC_MARKER.exec(clean);
  const failureM = FAILURE_MARKER.exec(clean);

  let action: string | undefined;
  let test: string | undefined;
  let metric: string | undefined;

  const trimEnd = (s: string) =>
    s.replace(/[\s.,;:—–\-]+$/, "").trim();

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
    if (!testM) {
      action = trimEnd(clean.slice(0, metricM.index));
    }
    const metricStart = metricM.index + metricM[0].length;
    const metricEnd =
      failureM && failureM.index > metricM.index
        ? failureM.index
        : clean.length;
    metric = trimEnd(clean.slice(metricStart, metricEnd));
  }

  // Truncate for display; leave undefined when empty.
  const t = (s: string | undefined) =>
    s && s.length > 0 ? truncate(s, 100) : undefined;
  return { action: t(action), test: t(test), metric: t(metric) };
}

// Extract gate bullets from §9 body. Accepts:
//   - *Day 7:* If ...
//   - *Tag 14:*
//   - **Day 30.** ...
function extractGates(body: string): Gate[] {
  const gateRe =
    /(^|\n)[\-*]\s*[*_]{1,2}\s*([A-Za-zÀ-ÿ]+)\s*(\d+)\s*[.:*_]*\s*[*_]{0,2}\s*([\s\S]*?)(?=(?:\n[\-*]\s*[*_]{1,2}\s*[A-Za-zÀ-ÿ]+\s*\d+)|$)/g;
  const gates: Gate[] = [];
  const seen = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = gateRe.exec(body)) !== null) {
    const noun = m[2];
    if (!/^(day|tag|dag|día|dia|jour)$/i.test(noun)) continue;
    const day = Number(m[3]);
    if (!Number.isFinite(day) || day < 1 || day > 365) continue;
    if (seen.has(day)) continue;
    seen.add(day);
    const summary = truncate(cleanBullet(m[4]), 240);
    gates.push({
      day,
      label: `${noun} ${day}`,
      summary,
      decisions: detectDecisions(m[4]),
    });
  }
  gates.sort((a, b) => a.day - b.day);
  return gates;
}

// Multilingual keyword lists for the three decision paths.
const CONTINUE_WORDS = [
  "continue",
  "green-light",
  "green light",
  "greenlight",
  "go",
  "proceed",
  "ship",
  "grün",
  "gruen",
  "weiter",
  "weitermachen",
  "fortsetzen",
  "doorgaan",
  "groen licht",
  "continuar",
  "seguir",
  "continuer",
  "poursuivre",
];
const PIVOT_WORDS = ["pivot", "pivotieren", "pivoteren", "pivotar", "pivoter"];
const KILL_WORDS = [
  "kill",
  "abort",
  "stop",
  "abbrechen",
  "einstellen",
  "abbruch",
  "stoppen",
  "matar",
  "cancelar",
  "abandonar",
  "arrêter",
  "arreter",
  "abandonner",
];

function detectDecisions(text: string): GateDecision[] {
  const lower = text.toLowerCase();
  const out: GateDecision[] = [];
  if (CONTINUE_WORDS.some((w) => containsWord(lower, w))) out.push("continue");
  if (PIVOT_WORDS.some((w) => containsWord(lower, w))) out.push("pivot");
  if (KILL_WORDS.some((w) => containsWord(lower, w))) out.push("kill");
  // Default: if nothing detected, offer a neutral continue path so the diagram
  // is still connected rather than a dead end.
  if (out.length === 0) out.push("continue");
  return out;
}

function containsWord(hay: string, needle: string): boolean {
  if (needle.includes(" ") || needle.includes("-")) {
    return hay.includes(needle);
  }
  // Word-start boundary only. Lets "grün" match "grünes", "pivot" match
  // "pivotieren", "kill" match "killed" — but not "skill" or "spivot".
  const re = new RegExp(`\\b${escapeRegExp(needle)}`, "i");
  return re.test(hay);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanBullet(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s.:—–-]+/, "")
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip markdown links
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return safe.replace(/[,;:.\s]+$/, "") + "…";
}

export function parseFlowchart(planMarkdown: string): FlowchartData | null {
  const section8 = findSection(planMarkdown, SECTION_8_PATTERNS);
  const section9 = findSection(planMarkdown, SECTION_9_PATTERNS);
  if (!section8 && !section9) return null;
  const weeks = section8 ? extractWeeks(section8) : [];
  const gates = section9 ? extractGates(section9) : [];
  if (weeks.length === 0 && gates.length === 0) return null;
  return { weeks, gates };
}
