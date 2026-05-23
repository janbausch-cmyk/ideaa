// IDEAA-72 Phase A: Stripe success redirect landing point.
//
// Stripe Payment Link "Success URL" is configured to:
//   https://<host>/api/unlock/success?session_id={CHECKOUT_SESSION_ID}
//
// Flow:
//   1. Stripe sends user here after payment with ?session_id=cs_...
//   2. We look up `idea_unlocks` by that session id (written by the webhook).
//   3. If found → set device unlock cookie, 303 to /ideas/{ideaId}?paid=1.
//   4. If not yet found (webhook race), render a tiny "processing" HTML page
//      with a meta-refresh so the user lands on the unlocked report as soon
//      as the webhook commits.
//
// We deliberately do NOT trust the session_id by itself — only a DB row that
// was written by the signature-verified webhook is proof of payment.

import { redirect } from "next/navigation";

import { getIdeaUnlockBySession, isValidIdeaId } from "@/lib/db";
import { setUnlockCookie } from "@/lib/unlock-cookies";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

// Reasonable upper bound on Stripe session ids; rejects junk early.
const SESSION_ID_RE = /^[A-Za-z0-9_]{8,200}$/;

function renderProcessingPage(sessionId: string, attempt: number): Response {
  const safeSessionId = sessionId.replace(/[^A-Za-z0-9_]/g, "");
  const nextUrl = `/api/unlock/success?session_id=${encodeURIComponent(safeSessionId)}&attempt=${attempt + 1}`;
  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="refresh" content="2; url=${nextUrl}" />
<title>Zahlung wird verbucht…</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.5; }
  h1 { font-size: 1.25rem; }
  .muted { color: #666; font-size: 0.9rem; }
</style>
</head>
<body>
<h1>Zahlung wird verbucht…</h1>
<p>Danke für deinen Kauf. Wir warten gerade auf die Bestätigung von Stripe.</p>
<p class="muted">Diese Seite lädt automatisch in 2 Sekunden neu. Sobald die Zahlung verbucht ist, springst du direkt in deine volle Analyse.</p>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderFailurePage(): Response {
  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Freischaltung fehlgeschlagen</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; line-height: 1.5; }
  h1 { font-size: 1.25rem; }
  .muted { color: #666; font-size: 0.9rem; }
</style>
</head>
<body>
<h1>Freischaltung konnte nicht bestätigt werden</h1>
<p>Wir konnten deine Zahlung gerade nicht der Idee zuordnen. Wenn der Betrag in deinem Stripe-Beleg auftaucht, melde dich bitte kurz — wir schalten dann manuell frei.</p>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ~30s total wait via 15 refresh cycles of 2s each, then surface a friendly
// "still pending" page so the buyer has a path forward.
const MAX_ATTEMPTS = 15;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
    return new Response("Missing or invalid session_id", { status: 400 });
  }

  const attempt = Math.max(
    0,
    Math.min(
      Number.parseInt(url.searchParams.get("attempt") ?? "0", 10) || 0,
      MAX_ATTEMPTS,
    ),
  );

  let unlock: { ideaId: string } | null = null;
  try {
    unlock = await getIdeaUnlockBySession(sessionId);
  } catch (err) {
    console.error("[/api/unlock/success] getIdeaUnlockBySession failed", err);
  }

  if (unlock && isValidIdeaId(unlock.ideaId)) {
    await setUnlockCookie(unlock.ideaId);
    redirect(`/ideas/${unlock.ideaId}?paid=1`);
  }

  if (attempt >= MAX_ATTEMPTS) {
    return renderFailurePage();
  }
  return renderProcessingPage(sessionId, attempt);
}
