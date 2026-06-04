// Claude-Haiku-based intent classifier for free-form Telegram messages.
// Decides whether a message should become an IDEAA idea, a Paperclip task,
// a comment on the active issue, a conversational question for the bot to
// answer directly, or stay unclear (→ ask the user).

import "server-only";

import Anthropic from "@anthropic-ai/sdk";

const ROUTER_MODEL = "claude-haiku-4-5-20251001";
const ANSWER_MODEL = "claude-haiku-4-5-20251001";

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!cachedClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    cachedClient = new Anthropic({ apiKey, maxRetries: 4 });
  }
  return cachedClient;
}

export type Intent =
  | { kind: "idea"; ideaText: string; confidence: "high" | "medium" | "low" }
  | { kind: "task"; title: string; confidence: "high" | "medium" | "low" }
  | { kind: "comment"; confidence: "high" | "medium" | "low" }
  | { kind: "question"; confidence: "high" | "medium" | "low" }
  | { kind: "unclear"; reason: string };

const ROUTER_SYSTEM = `Du bist ein Routing-Klassifikator für einen Telegram-Bot. Der Bot bedient einen Solo-Founder (Jan, IDEAA).

Drei Systeme stehen dahinter:
- IDEAA: KI-gestützte Validierungs-Berichte für Geschäftsideen. Input: Idee-Text (1 Satz bis mehrere Absätze). Output: strukturierter Bericht mit Markteinschätzung, Konkurrenz, Risiken, 30-Tage-Plan.
- Paperclip: Issue-Tracker. Aufgaben, Follow-ups, Issue-Kommentare.
- Bot selbst: kann konversationelle Rückfragen beantworten.

Klassifiziere die Nachricht in EINE der Kategorien:
- "idea": Der User formuliert eine Geschäftsidee zur Validierung. Beispiele: "App für Hundebesitzer die Sitter finden", "Validier mal: SaaS-Tool für Steuerberater". Auch implizite Ideen ohne Verb: "Schraubendreher-Shop für Frauen". Faustregel: wenn man sich vorstellen kann, das in IDEAA einzureichen → idea.
- "task": Eine neue Aufgabe/ein To-Do für den Founder selbst. Beispiele: "morgen Rechnungen schreiben", "Pitch-Deck überarbeiten", "Anwalt anrufen wegen Impressum". Konkrete handlungsorientierte Aktion, nicht zu validieren.
- "comment": Der User antwortet auf ein bestehendes Paperclip-Issue (Kommentar, Status-Update, Frage zum Issue). Erkennbar an Bezug auf vorigen Kontext: "ja mach so", "passt", "warte noch".
- "question": Eine Wissensfrage an den Bot. Beispiele: "wie viele Ideen habe ich diese Woche eingereicht", "was war meine letzte Idee", "wie funktioniert die Analyse".
- "unclear": Wirklich nicht zuzuordnen.

Antworte AUSSCHLIESSLICH mit JSON in genau diesem Schema:
{"kind": "idea|task|comment|question|unclear", "confidence": "high|medium|low", "ideaText": "...", "title": "...", "reason": "..."}

- Bei "idea": gib unter ideaText den Text der Idee (kann der Original-Text sein oder leicht aufgeräumt).
- Bei "task": gib unter title einen kurzen Issue-Titel (max 80 Zeichen).
- Bei "comment", "question", "unclear": ideaText und title weglassen oder leer.
- Bei "unclear": gib unter reason kurz an, warum nicht klassifizierbar.

Kein Vorwort, kein Markdown, kein \`\`\`-Block. Nur das reine JSON.`;

export async function classifyIntent(args: {
  text: string;
  hasActiveIssue: boolean;
}): Promise<Intent> {
  const userPrompt = args.hasActiveIssue
    ? `Es gibt ein aktives Paperclip-Issue. Wenn die Nachricht plausibel ein Kommentar darauf ist, bevorzuge "comment".\n\nNachricht:\n${args.text}`
    : `Es gibt KEIN aktives Paperclip-Issue. "comment" ist daher nur sinnvoll, wenn die Nachricht explizit Bezug auf einen vorigen Austausch nimmt.\n\nNachricht:\n${args.text}`;

  const client = getClient();
  let response;
  try {
    response = await client.messages.create({
      model: ROUTER_MODEL,
      max_tokens: 200,
      system: [
        {
          type: "text",
          text: ROUTER_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch (err) {
    return {
      kind: "unclear",
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "unclear", reason: `Router gab kein JSON zurück: ${text.slice(0, 120)}` };
  }

  const kind = parsed.kind;
  const confidenceRaw = parsed.confidence;
  const confidence =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
      ? confidenceRaw
      : "low";

  if (kind === "idea") {
    const ideaText =
      typeof parsed.ideaText === "string" && parsed.ideaText.trim().length > 0
        ? parsed.ideaText.trim()
        : args.text;
    return { kind: "idea", ideaText, confidence };
  }
  if (kind === "task") {
    const title =
      typeof parsed.title === "string" && parsed.title.trim().length > 0
        ? parsed.title.trim().slice(0, 80)
        : args.text.slice(0, 80);
    return { kind: "task", title, confidence };
  }
  if (kind === "comment") return { kind: "comment", confidence };
  if (kind === "question") return { kind: "question", confidence };
  return {
    kind: "unclear",
    reason: typeof parsed.reason === "string" ? parsed.reason : "kind unbekannt",
  };
}

const ANSWER_SYSTEM = `Du bist der IDEAA-Telegram-Bot. Du beantwortest kurze Fragen knapp und freundlich auf Deutsch (Du-Form). Du hast keinen Zugriff auf die DB oder Live-Daten — wenn die Frage konkrete Stats braucht, sag ehrlich, dass du das nicht aus dem Kopf weißt, und schlag den passenden Slash-Befehl vor (\`/inbox\` für Paperclip, /admin im Browser für IDEAA-Stats). Max 3 Sätze. Keine Em-Dashes (—).`;

export async function answerQuestion(text: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: ANSWER_MODEL,
    max_tokens: 300,
    system: [
      {
        type: "text",
        text: ANSWER_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: text }],
  });
  return response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}
