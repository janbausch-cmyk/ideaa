// IDEAA-69 Phase A: Stripe webhook → Telegram notification.
// Stripe handles checkout + conversion tracking itself. This endpoint is just
// the "ping Jan when money arrives" hook. Stays dumb on purpose; richer
// fulfilment / DB-of-purchases comes with Phase B (auth + entitlements).

import { sendMessage } from "@/lib/telegram/client";
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

function buildNotificationMessage(
  eventType: string,
  data: Record<string, unknown>,
): string {
  if (eventType.startsWith("checkout.session")) {
    const s = data as CheckoutSessionLike;
    const amount = formatAmountFromMinor(s.amount_total, s.currency);
    const email =
      s.customer_email ??
      s.customer_details?.email ??
      "(keine E-Mail)";
    const ideaRef = s.client_reference_id ? `\nIdee: ${s.client_reference_id}` : "";
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
    const amount = formatAmountFromMinor(p.amount, p.currency);
    return (
      `💶 IDEAA Phase A — Payment succeeded\n` +
      `Betrag: ${amount}\n` +
      `Käufer: ${p.receipt_email ?? "(keine E-Mail)"}\n` +
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

  if (!NOTIFY_EVENT_TYPES.has(event.type)) {
    return Response.json({ ok: true, ignored: event.type });
  }

  const chatId = getNotifyChatId();
  if (!chatId) {
    console.warn(
      "[stripe-webhook] no Telegram chat id configured — event %s dropped",
      event.id,
    );
    return Response.json({ ok: true, notified: false });
  }

  const text = buildNotificationMessage(event.type, event.data.object ?? {});
  try {
    await sendMessage({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] telegram send failed", message);
    // 200 anyway — Stripe will replay 5xx, and we don't want infinite retries
    // on a Telegram outage. The event is already verified-genuine; Jan can
    // also see it in the Stripe dashboard.
    return Response.json({ ok: true, notified: false, error: message });
  }

  return Response.json({ ok: true, notified: true });
}
