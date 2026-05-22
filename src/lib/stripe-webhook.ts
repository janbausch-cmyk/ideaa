// IDEAA-69 Phase A: manual Stripe webhook signature verifier.
// We don't pull the `stripe` SDK because we only need: (1) verify HMAC-SHA256
// signature on the raw body, (2) parse the JSON event. Anything richer is
// Phase B (real billing). See:
//   https://stripe.com/docs/webhooks/signatures

import { createHmac, timingSafeEqual } from "node:crypto";

const SIG_TOLERANCE_SECONDS = 5 * 60; // Stripe's default replay-attack window.

export type StripeVerifyResult =
  | { ok: true; event: StripeEvent }
  | { ok: false; reason: string };

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function parseSignatureHeader(header: string): {
  timestamp: number | null;
  v1Signatures: string[];
} {
  let timestamp: number | null = null;
  const v1Signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (!k || !v) continue;
    if (k.trim() === "t") {
      const n = Number.parseInt(v.trim(), 10);
      if (Number.isFinite(n)) timestamp = n;
    } else if (k.trim() === "v1") {
      v1Signatures.push(v.trim());
    }
  }
  return { timestamp, v1Signatures };
}

export function verifyStripeWebhook(args: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  nowSeconds?: number;
}): StripeVerifyResult {
  if (!args.signatureHeader) {
    return { ok: false, reason: "Missing Stripe-Signature header" };
  }
  const { timestamp, v1Signatures } = parseSignatureHeader(args.signatureHeader);
  if (timestamp === null) {
    return { ok: false, reason: "Signature header missing t=" };
  }
  if (v1Signatures.length === 0) {
    return { ok: false, reason: "Signature header missing v1=" };
  }

  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > SIG_TOLERANCE_SECONDS) {
    return { ok: false, reason: "Signature timestamp outside tolerance" };
  }

  const expected = createHmac("sha256", args.secret)
    .update(`${timestamp}.${args.rawBody}`, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const match = v1Signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, "utf8");
    return (
      sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)
    );
  });
  if (!match) {
    return { ok: false, reason: "Signature mismatch" };
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(args.rawBody) as StripeEvent;
  } catch {
    return { ok: false, reason: "Body is not JSON" };
  }
  if (!event || typeof event !== "object" || typeof event.type !== "string") {
    return { ok: false, reason: "Body missing event.type" };
  }
  return { ok: true, event };
}

export function formatAmountFromMinor(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (typeof amountMinor !== "number" || !Number.isFinite(amountMinor)) {
    return "?";
  }
  const major = amountMinor / 100;
  const cur = (currency ?? "eur").toUpperCase();
  return `${major.toFixed(2)} ${cur}`;
}
