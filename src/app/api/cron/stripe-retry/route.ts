// Daily cron: retry Telegram delivery for stripe_events that came in but
// never got notified (Telegram outage, missing chat-id config, etc.). Without
// this, a Stripe purchase could land in the DB but never reach the founder.

import {
  listUnnotifiedStripeEvents,
  markStripeEventNotified,
} from "@/lib/db";
import { formatAmountFromMinor } from "@/lib/stripe-webhook";
import { sendMessage } from "@/lib/telegram/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NOTIFY_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "payment_intent.succeeded",
]);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function isAuthorizedCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length === 0) return false;
  const header = request.headers.get("authorization");
  if (!header) return false;
  const presented = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : null;
  if (!presented) return false;
  return timingSafeEqual(presented, expected);
}

function getNotifyChatId(): string | null {
  const explicit = process.env.IDEAA_NOTIFY_TELEGRAM_CHAT_ID;
  if (explicit && explicit.trim()) return explicit.trim();
  const allowed = process.env.TELEGRAM_ALLOWED_USER_IDS;
  if (!allowed) return null;
  const first = allowed.split(",")[0]?.trim();
  return first || null;
}

type RetryResult = {
  total: number;
  resent: number;
  still_failing: number;
  ignored_event_type: number;
  details: Array<{ id: string; type: string; status: "ok" | "skip" | "fail"; error?: string }>;
};

async function retry(): Promise<RetryResult> {
  const events = await listUnnotifiedStripeEvents(50);
  const chatId = getNotifyChatId();
  const result: RetryResult = {
    total: events.length,
    resent: 0,
    still_failing: 0,
    ignored_event_type: 0,
    details: [],
  };

  if (!chatId) {
    // No chat id configured. Don't loop forever; mark them as we can't deliver.
    for (const ev of events) {
      await markStripeEventNotified(
        ev.id,
        false,
        "no Telegram chat id configured",
      );
      result.still_failing++;
      result.details.push({
        id: ev.id,
        type: ev.type,
        status: "fail",
        error: "no chat id",
      });
    }
    // Log so this surfaces in Sentry / Vercel logs.
    console.error(
      "[cron stripe-retry] %d unsent events but no IDEAA_NOTIFY_TELEGRAM_CHAT_ID / TELEGRAM_ALLOWED_USER_IDS",
      events.length,
    );
    return result;
  }

  for (const ev of events) {
    if (!NOTIFY_EVENT_TYPES.has(ev.type)) {
      // Not a purchase event: mark as ignored, don't retry forever.
      await markStripeEventNotified(ev.id, true, null);
      result.ignored_event_type++;
      result.details.push({ id: ev.id, type: ev.type, status: "skip" });
      continue;
    }

    const amount = formatAmountFromMinor(ev.amount_minor, ev.currency);
    const email = ev.customer_email ?? "(keine E-Mail)";
    const ideaRef = ev.idea_id ? `\nIdee: ${ev.idea_id}` : "";
    const text =
      `💶 IDEAA Stripe (nachgereicht via Retry-Cron)\n` +
      `Event: ${ev.type}\n` +
      `Betrag: ${amount}\n` +
      `Käufer: ${email}` +
      ideaRef +
      `\nEvent-ID: ${ev.id}\n` +
      `Empfangen: ${ev.created_at}`;

    try {
      await sendMessage({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      });
      await markStripeEventNotified(ev.id, true, null);
      result.resent++;
      result.details.push({ id: ev.id, type: ev.type, status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markStripeEventNotified(ev.id, false, message);
      result.still_failing++;
      result.details.push({
        id: ev.id,
        type: ev.type,
        status: "fail",
        error: message,
      });
      console.error(
        "[cron stripe-retry] event %s still failing: %s",
        ev.id,
        message,
      );
    }
  }

  return result;
}

async function run(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const startedAt = Date.now();
  try {
    const result = await retry();
    return Response.json({
      ok: true,
      elapsed_ms: Date.now() - startedAt,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron stripe-retry] failed", message);
    return Response.json(
      { ok: false, error: message, elapsed_ms: Date.now() - startedAt },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
