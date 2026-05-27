// Stripe webhook → DB audit row → Telegram notification.
// Generic event handler: signature-verifies the event, stores it in
// `stripe_events` (idempotent on event id), and pings Telegram on
// payment-success types. Kept post-IDEAA-83 paywall removal as a passive
// audit/notify hook for any future Stripe activity.

import { sendMessage } from "@/lib/telegram/client";
import {
  markStripeEventNotified,
  recordStripeEvent,
} from "@/lib/db";
import {
  formatAmountFromMinor,
  verifyStripeWebhook,
} from "@/lib/stripe-webhook";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const NOTIFY_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "payment_intent.succeeded",
]);

function getNotifyChatId(): string | null {
  const explicit = process.env.IDEAA_NOTIFY_TELEGRAM_CHAT_ID;
  if (explicit && explicit.trim()) return explicit.trim();
  // Fallback: first entry of TELEGRAM_ALLOWED_USER_IDS. Same person in our
  // single-tenant Phase-A setup.
  const allowed = process.env.TELEGRAM_ALLOWED_USER_IDS;
  if (!allowed) return null;
  const first = allowed.split(",")[0]?.trim();
  return first || null;
}

type CheckoutSessionLike = {
  id?: string;
  amount_total?: number | null;
  currency?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  client_reference_id?: string | null;
  payment_link?: string | null;
  metadata?: Record<string, string> | null;
};

type PaymentIntentLike = {
  id?: string;
  amount?: number | null;
  currency?: string | null;
  receipt_email?: string | null;
  metadata?: Record<string, string> | null;
};

type EventSummary = {
  amountMinor: number | null;
  currency: string | null;
  customerEmail: string | null;
  ideaId: string | null;
  sessionId: string | null;
};

function summarizeEvent(
  eventType: string,
  data: Record<string, unknown>,
): EventSummary {
  if (eventType.startsWith("checkout.session")) {
    const s = data as CheckoutSessionLike;
    return {
      amountMinor: s.amount_total ?? null,
      currency: s.currency ?? null,
      customerEmail: s.customer_email ?? s.customer_details?.email ?? null,
      ideaId: s.client_reference_id ?? null,
      sessionId: s.id ?? null,
    };
  }
  if (eventType === "payment_intent.succeeded") {
    const p = data as PaymentIntentLike;
    return {
      amountMinor: p.amount ?? null,
      currency: p.currency ?? null,
      customerEmail: p.receipt_email ?? null,
      ideaId: null,
      sessionId: null,
    };
  }
  return {
    amountMinor: null,
    currency: null,
    customerEmail: null,
    ideaId: null,
    sessionId: null,
  };
}

function buildNotificationMessage(
  eventType: string,
  data: Record<string, unknown>,
  summary: EventSummary,
): string {
  const amount = formatAmountFromMinor(summary.amountMinor, summary.currency);
  const email = summary.customerEmail ?? "(keine E-Mail)";
  const ideaRef = summary.ideaId ? `\nIdee: ${summary.ideaId}` : "";

  if (eventType.startsWith("checkout.session")) {
    const s = data as CheckoutSessionLike;
    return (
      `💶 IDEAA Phase A — Kauf eingegangen!\n` +
      `Betrag: ${amount}\n` +
      `Käufer: ${email}` +
      ideaRef +
      `\nSession: ${s.id ?? "?"}\n\n` +
      `→ Manuelle Lieferung gemäß docs/phase-a-monetization.md.`
    );
  }
  if (eventType === "payment_intent.succeeded") {
    const p = data as PaymentIntentLike;
    return (
      `💶 IDEAA Phase A — Payment succeeded\n` +
      `Betrag: ${amount}\n` +
      `Käufer: ${email}\n` +
      `Intent: ${p.id ?? "?"}`
    );
  }
  return `Stripe event: ${eventType}`;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Fail explicitly so misconfigured deploys are visible in Stripe's
    // dashboard rather than silently dropping events.
    return Response.json(
      { ok: false, error: "STRIPE_WEBHOOK_SECRET is not set" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");
  const verified = verifyStripeWebhook({
    rawBody,
    signatureHeader,
    secret,
  });
  if (!verified.ok) {
    return Response.json(
      { ok: false, error: verified.reason },
      { status: 400 },
    );
  }
  const event = verified.event;
  const summary = summarizeEvent(event.type, event.data.object ?? {});

  // Append audit row. Dedupes on the Stripe event id, so retries are safe.
  let inserted = false;
  try {
    inserted = await recordStripeEvent({
      id: event.id,
      type: event.type,
      amountMinor: summary.amountMinor,
      currency: summary.currency,
      customerEmail: summary.customerEmail,
      ideaId: summary.ideaId,
      payload: event,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] recordStripeEvent failed", message);
    // Don't 5xx — Stripe will retry-storm and we'd rather notify once than
    // miss the event entirely. Continue and try the Telegram notify.
  }

  if (!NOTIFY_EVENT_TYPES.has(event.type)) {
    return Response.json({
      ok: true,
      ignored: event.type,
      stored: inserted,
    });
  }

  // If this is a Stripe retry of an already-notified event, skip the Telegram
  // ping (avoid spamming Jan on flaky webhook ACKs).
  if (!inserted) {
    return Response.json({
      ok: true,
      duplicate: true,
      event: { id: event.id, type: event.type },
    });
  }

  const chatId = getNotifyChatId();
  if (!chatId) {
    console.warn(
      "[stripe-webhook] no Telegram chat id configured — event %s stored but not notified",
      event.id,
    );
    await markStripeEventNotified(event.id, false, "no chat id configured");
    return Response.json({ ok: true, notified: false, stored: true });
  }

  const text = buildNotificationMessage(
    event.type,
    event.data.object ?? {},
    summary,
  );
  try {
    await sendMessage({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });
    await markStripeEventNotified(event.id, true, null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] telegram send failed", message);
    await markStripeEventNotified(event.id, false, message);
    // 200 anyway — Stripe will replay 5xx, and we don't want infinite retries
    // on a Telegram outage. The event is already stored and verified-genuine;
    // Jan can also see it in the Stripe dashboard.
    return Response.json({ ok: true, notified: false, error: message });
  }

  return Response.json({
    ok: true,
    notified: true,
    stored: true,
    event: { id: event.id, type: event.type },
  });
}
