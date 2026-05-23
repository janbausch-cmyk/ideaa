// IDEAA-72 Phase A: paywall click — log the demand event, then 303-redirect to
// the €1.99 Stripe Payment Link with client_reference_id={idea} so the webhook
// can correlate the purchase back to this idea.
//
// Fail-open: if logging fails we still redirect. If the payment link isn't
// configured we fall back to the same mailto handoff as the Tier-2/3 CTA.

import { after } from "next/server";

import { recordCtaClick } from "@/lib/db";
import {
  fallbackContactEmail,
  UNLOCK_PRICE_EURO,
  UNLOCK_TIER_ID,
  unlockPaymentLink,
} from "@/lib/monetization";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ideaId = url.searchParams.get("idea");
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");

  after(async () => {
    try {
      await recordCtaClick({
        ideaId,
        tier: UNLOCK_TIER_ID,
        userAgent,
        referer,
      });
    } catch (err) {
      console.error("[/api/unlock/start] failed to record click", err);
    }
  });

  const stripeUrl = unlockPaymentLink();
  if (stripeUrl) {
    const target = new URL(stripeUrl);
    if (ideaId) {
      target.searchParams.set("client_reference_id", ideaId);
    }
    return Response.redirect(target.toString(), 303);
  }

  const email = fallbackContactEmail();
  if (email) {
    const subject = encodeURIComponent(
      `IDEAA – Volle Analyse freischalten (€${UNLOCK_PRICE_EURO.toFixed(2)})`,
    );
    const body = encodeURIComponent(
      `Hi Jan,\n\nIch würde die volle Ausarbeitung freischalten.` +
        (ideaId ? `\n\nIdee: ${ideaId}` : "") +
        `\n\nDanke!`,
    );
    return Response.redirect(
      `mailto:${email}?subject=${subject}&body=${body}`,
      303,
    );
  }

  return new Response(
    "Die Freischaltung ist gerade nicht aktiv. Bitte später erneut versuchen.",
    {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}
