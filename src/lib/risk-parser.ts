// Parser for §3 (Risks & Kill-Kriterien) of the analysis report. Returns a
// structured shape the RiskAssessment component can render as a traffic-light
// widget plus per-risk cards.
//
// Deliberately multilingual: the prompt tells the LLM to translate section
// headings and body prose into the input language (DE, NL, ES, FR, EN). We
// match section headings via a numbered pattern (`## 3.`) with a heading-text
// fallback, and detect severity keywords via multilingual word lists.
//
// Chosen over prompt-JSON (Option a in IDEAA-164) for v0 because:
//   - works retroactively for every idea already in the DB
//   - no prompt change → no re-QA on the analysis output
//   - matches the pattern established by flowchart-parser.ts (IDEAA-163)
// If quality is insufficient, we can migrate to structured LLM output later
// without changing the component's public shape.

export type RiskSeverity = "low" | "medium" | "high";

export type Risk = {
  title: string;
  killCriterion: string | null;
  body: string;
  severity: RiskSeverity;
};

export type RiskAssessmentData = {
  overall: RiskSeverity;
  risks: Risk[];
};

const SECTION_3_PATTERNS: RegExp[] = [
  /(^|\n)#{1,3}\s*3[.)]\s.*$/im,
  /(^|\n)#{1,3}\s*(?:Risks?\s*&\s*kill|Risiken\s*&\s*Kill|Risico'?s?\s*(?:en|&)\s*(?:kill|stop)|Riesgos\s*(?:y|&)\s*(?:kill|criterios)|Risques\s*(?:et|&)\s*(?:kill|crit))/im,
];

function findSection(markdown: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const match = re.exec(markdown);
    if (!match || match.index === undefined) continue;
    const startOfLine = match.index + (match[1] === "\n" ? 1 : 0);
    const afterHeading = markdown.indexOf("\n", startOfLine);
    if (afterHeading === -1) continue;
    const rest = markdown.slice(afterHeading + 1);
    // Section ends at the next `## N.` heading.
    const nextHeading = /\n#{1,3}\s*\d+[.)]\s/.exec(rest);
    const body = nextHeading ? rest.slice(0, nextHeading.index) : rest;
    const trimmed = body.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
}

// Split §3 body into individual risk items. Accepts both unordered bullets
// (`- foo`, `* foo`) and ordered lists (`1. foo`, `2) foo`) — the prompt shows
// `- ` examples but the model regularly emits numbered lists for §3, which
// previously killed the whole risk widget silently (parser returned null →
// neither the Kurzurteil-Banner nor the Tacho rendered).
function splitBullets(body: string): string[] {
  // Prepend a newline so the very first bullet matches the leading anchor.
  const normalized = "\n" + body;
  const bulletRe = /\n(?:[\-*]|\d{1,2}[.)])\s+/g;
  const parts: string[] = [];
  const matches: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = bulletRe.exec(normalized)) !== null) {
    matches.push(m.index);
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i];
    const end = i + 1 < matches.length ? matches[i + 1] : normalized.length;
    parts.push(
      normalized
        .slice(start, end)
        .replace(/^\n(?:[\-*]|\d{1,2}[.)])\s+/, "")
        .trim(),
    );
  }
  return parts.filter((b) => b.length > 0);
}

// Regexes we run over the raw bullet to peel off decorations before slicing
// out a display title.
const STRIP_MD_LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;
const BROKEN_LINK_NOTE_RE = /\*\(Link nicht erreichbar\)\*/g;

function stripLinks(text: string): string {
  return text.replace(STRIP_MD_LINK_RE, "$1").replace(BROKEN_LINK_NOTE_RE, "");
}

// Pull a compact title out of a risk bullet. Preference:
//   1. First `*emphasized phrase*` / `**bold**` at the start (matches gold-standard).
//   2. First sentence, trimmed to ≤ 100 chars.
function extractTitle(bullet: string): string {
  const cleaned = stripLinks(bullet).trim();
  const emphMatch =
    /^\*{1,2}\s*([^*]{3,120})\s*\*{1,2}/.exec(cleaned) ??
    /^_{1,2}\s*([^_]{3,120})\s*_{1,2}/.exec(cleaned);
  if (emphMatch) {
    return sanitizeTitle(emphMatch[1]);
  }
  // Fall back to first sentence.
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/, 1)[0] ?? cleaned;
  return sanitizeTitle(truncate(firstSentence, 100));
}

function sanitizeTitle(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s.:—–\-*_]+/, "")
    .replace(/[\s.:—–\-*_]+$/, "")
    .trim();
}

// Kill/pivot markers we search for. Word-start match, case-insensitive.
// Language coverage: EN, DE, NL, ES, FR + the informal "Kill-Kriterium".
const KILL_MARKERS = [
  "**kill**",
  "**abbruch**",
  "**abbrechen**",
  "**stopp**",
  "**stop**",
  "**pivot**",
  "**kill/pivot**",
  "kill if",
  "kill when",
  "kill wenn",
  "abbruch wenn",
  "abbruch bei",
  "abbrechen wenn",
  "stoppen wenn",
  "stop if",
  "stop when",
  "matar si",
  "arrêter si",
  "arreter si",
  "cancelar si",
];

// Extract the sentence containing the kill criterion. Returns the sentence
// verbatim (with the marker preserved) or null if none is found.
function extractKillCriterion(bullet: string): string | null {
  const cleaned = stripLinks(bullet);
  const lower = cleaned.toLowerCase();
  let earliestIdx = -1;
  for (const marker of KILL_MARKERS) {
    const idx = lower.indexOf(marker);
    if (idx === -1) continue;
    if (earliestIdx === -1 || idx < earliestIdx) earliestIdx = idx;
  }
  if (earliestIdx === -1) return null;

  // Widen backwards to the sentence start.
  const sentenceStart = findSentenceStart(cleaned, earliestIdx);
  const sentenceEnd = findSentenceEnd(cleaned, earliestIdx);
  const sentence = cleaned
    .slice(sentenceStart, sentenceEnd)
    .replace(/\s+/g, " ")
    .replace(/^[\s.:—–\-*_]+/, "")
    .replace(/\*\*/g, "")
    .trim();
  return sentence.length > 0 ? sentence : null;
}

// Common abbreviations that end in a dot but do NOT end a sentence. Matched
// case-insensitively on the whitespace-delimited word ending at position i.
const NON_TERMINAL_ABBREVIATIONS = new Set([
  "vs",
  "e.g",
  "i.e",
  "z.b",
  "bzw",
  "usw",
  "etc",
  "ca",
  "z.b",
  "u.a",
  "vgl",
  "u.s.w",
]);

function isSentenceBreak(text: string, i: number): boolean {
  const ch = text[i];
  if (ch === "!" || ch === "?" || ch === "\n") return true;
  if (ch !== ".") return false;
  const next = text[i + 1];
  // End of string is a sentence break.
  if (!next) return true;
  // `.` followed by markdown emphasis close (`.*`, `._`) is a sentence break:
  // e.g. `*Crowded category, thin moat.*` ends a sentence.
  if (next === "*" || next === "_") return true;
  // Whitespace after the dot is a sentence break — but only if the word ending
  // at `i` is not a known abbreviation, and the char is not a decimal digit.
  if (/\s/.test(next)) {
    // Walk back to the start of the word ending at i (exclusive of `.`).
    let wordStart = i - 1;
    while (wordStart >= 0 && /[A-Za-zÀ-ÿ.]/.test(text[wordStart])) wordStart--;
    const word = text.slice(wordStart + 1, i).toLowerCase();
    if (NON_TERMINAL_ABBREVIATIONS.has(word)) return false;
    return true;
  }
  // `.` followed by digit is a decimal (`1.5x`), not a sentence break.
  return false;
}

function findSentenceStart(text: string, from: number): number {
  for (let i = from - 1; i >= 0; i--) {
    if (isSentenceBreak(text, i)) return i + 1;
  }
  return 0;
}

function findSentenceEnd(text: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    if (isSentenceBreak(text, i)) return i + 1;
  }
  return text.length;
}

// Severity keyword lists. Presence of any HIGH_SEVERITY word in a risk bumps
// that risk (and, transitively, the overall assessment) toward "high".
// Words are matched with a word-start regex (\b<w>) so "block" catches
// "blocked" / "blockiert" but not "unblocked".
const HIGH_SEVERITY_KEYWORDS = [
  // Legal / regulatory
  "legal",
  "regulator",
  "regulatorisch",
  "gdpr",
  "dsgvo",
  "compliance",
  "patent",
  "trademark",
  "markenrecht",
  "urheberrecht",
  "copyright",
  "lawsuit",
  "klage",
  "gesetz",
  "verboten",
  "illegal",
  "prohibited",
  "banned",
  "sanktion",
  "sanction",
  // Platform / vendor lock-in / shutdown
  "shutdown",
  "eingestellt",
  "abgeschaltet",
  "tos",
  "agb",
  "terms of service",
  "api revoked",
  "revoked",
  "widerrufen",
  "monopol",
  "monopoly",
  "gatekeeper",
  // Existential business
  "kannibalisier",
  "cannibaliz",
  "existential",
  "existenziell",
  "existenzbedrohend",
];

// Low-severity hints are intentionally narrow: they must be phrases that only
// appear when the analyst is downplaying a risk, not descriptions of the risk
// itself. "gering" alone is too broad (a risk titled "Geringes Reply-Uplift"
// is itself a real risk, not a low-severity one), so we require phrasing that
// signals mitigation is easy.
const LOW_SEVERITY_HINTS = [
  "leicht mitigierbar",
  "einfach zu adressieren",
  "unproblematisch",
  "easily mitigated",
  "easy to address",
];

function containsWord(hay: string, needle: string): boolean {
  if (needle.includes(" ")) return hay.includes(needle);
  const re = new RegExp(`\\b${escapeRegExp(needle)}`, "i");
  return re.test(hay);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classifyRiskSeverity(bullet: string): RiskSeverity {
  const lower = stripLinks(bullet).toLowerCase();
  const hasHigh = HIGH_SEVERITY_KEYWORDS.some((w) => containsWord(lower, w));
  if (hasHigh) return "high";
  const hasLow = LOW_SEVERITY_HINTS.some((w) => containsWord(lower, w));
  if (hasLow) return "low";
  return "medium";
}

// Overall severity: aggregate of individual risk severities plus a bump for
// count. A ranked-3-risk report reads as medium by default; 4+ ranked risks
// or any risk classified "high" pushes the overall to "high".
function classifyOverall(risks: Risk[]): RiskSeverity {
  if (risks.length === 0) return "low";
  const anyHigh = risks.some((r) => r.severity === "high");
  if (anyHigh) return "high";
  if (risks.length >= 4) return "high";
  if (risks.length >= 3) return "medium";
  const anyMedium = risks.some((r) => r.severity === "medium");
  return anyMedium ? "medium" : "low";
}

function cleanBody(bullet: string): string {
  return stripLinks(bullet)
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return safe.replace(/[,;:.\s]+$/, "") + "…";
}

export function parseRiskAssessment(
  reportMarkdown: string,
): RiskAssessmentData | null {
  const section = findSection(reportMarkdown, SECTION_3_PATTERNS);
  if (!section) return null;
  const bullets = splitBullets(section);
  if (bullets.length === 0) return null;
  const risks: Risk[] = bullets.map((bullet) => ({
    title: extractTitle(bullet),
    killCriterion: extractKillCriterion(bullet),
    body: cleanBody(bullet),
    severity: classifyRiskSeverity(bullet),
  }));
  const filtered = risks.filter((r) => r.title.length > 0);
  if (filtered.length === 0) return null;
  return {
    overall: classifyOverall(filtered),
    risks: filtered,
  };
}
