// IDEAA-69 Phase A: clicks on the Stripe Payment Link CTA buttons go through
// this endpoint so we can count demand before redirecting to Stripe. Fail-open:
// if logging fails the user still gets redirected — we'd rather lose a click
// count than block a paying user.

import { after } from "next/server";

import { recordCtaClick } from "@/lib/db";
import {
  fallbackContactEmail,
  getTier,
  tierPaymentLink,
} from "@/lib/monetization";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(
  request: Request,
  ctx: { params: Promise<{ tier: string }> },
) {
  const { tier: tierId } = await ctx.params;
  const tier = getTier(tierId);
  if (!tier) {
    return Response.json({ ok: false, error: "Unknown tier" }, { status: 404 });
  }

  const url = new URL(request.url);
  const ideaId = url.searchParams.get("idea");
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");

  after(async () => {
    try {
      await recordCtaClick({
        ideaId,
        tier: tier.id,
        userAgent,
        referer,
      });
    } catch (err) {
      console.error("[/api/cta] failed to record click", err);
    }
  });

  const stripeUrl = tierPaymentLink(tier);
  if (stripeUrl) {
    const target = new URL(stripeUrl);
    if (ideaId) {
      // Pass the idea id through so the Stripe webhook handler can correlate
      // a purchase back to the originating Ausarbeitung.
      target.searchParams.set("client_reference_id", ideaId);
    }
    return Response.redirect(target.toString(), 303);
  }

  // No Stripe link configured yet — fall back to an email handoff so we still
  // capture intent. If that's also unset, return a small explanatory page.
  const email = fallbackContactEmail();
  if (email) {
    const subject = encodeURIComponent(`IDEAA – ${tier.title} (${tier.priceEuro}€)`);
    const body = encodeURIComponent(
      `Hi Jan,\n\nIch interessiere mich für "${tier.title}" (${tier.priceEuro}€).` +
        (ideaId ? `\n\nIdee: ${ideaId}` : "") +
        `\n\nDanke!`,
    );
    return Response.redirect(
      `mailto:${email}?subject=${subject}&body=${body}`,
      303,
    );
  }

  return new Response(
    `Diese Option (${tier.title}) ist noch nicht aktiv. ` +
      `Bitte später erneut versuchen.`,
    {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}
