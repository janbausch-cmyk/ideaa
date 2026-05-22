// Phase-A monetization tiers (IDEAA-69). Three Stripe Payment Links surfaced
// at the end of the public Ausarbeitung. Pure config + helpers; delivery is
// manual (see docs/phase-a-monetization.md).

export type TierId = "tier_25" | "tier_50" | "tier_100";

export type Tier = {
  id: TierId;
  priceEuro: number;
  title: string;
  tagline: string;
  blurb: string;
  envVar: string;
};

export const TIERS: ReadonlyArray<Tier> = [
  {
    id: "tier_25",
    priceEuro: 25,
    title: "Tiefer-Analyse",
    tagline: "Erweiterte Ausarbeitung deiner Idee",
    blurb:
      "Zielkunden-Schärfung, Wettbewerbs-Detail, MVP-Skizze, 30/60/90-Plan und Risiken. Wird manuell per E-Mail geliefert (typisch 48h).",
    envVar: "STRIPE_PAYMENT_LINK_25",
  },
  {
    id: "tier_50",
    priceEuro: 50,
    title: "Co-Founder-Pitch-Deck",
    tagline: "Slides-Outline + Risk-Storyline",
    blurb:
      "Strukturiertes 10–12-Slide Deck-Outline mit Problem/Markt/Wedge/Ask plus Risiko-Storyline für Co-Founder-Gespräche. Manuell geliefert.",
    envVar: "STRIPE_PAYMENT_LINK_50",
  },
  {
    id: "tier_100",
    priceEuro: 100,
    title: "Vollberatungs-Stunde",
    tagline: "60-min Call + schriftliche Zusammenfassung",
    blurb:
      "60-min 1:1-Call mit Jan plus eine schriftliche Zusammenfassung mit Next-Actions, Risiken und konkreten Schritten.",
    envVar: "STRIPE_PAYMENT_LINK_100",
  },
];

export function getTier(id: string): Tier | null {
  return TIERS.find((t) => t.id === id) ?? null;
}

export function isTierId(s: string): s is TierId {
  return TIERS.some((t) => t.id === s);
}

// Returns the configured Stripe Payment Link for a tier, or null if the env
// var isn't set. The CTA UI falls back to a "noch nicht aktiv" badge so the
// build keeps shipping while Jan finalises the Stripe account (IDEAA-69 §Voraussetzungen).
export function tierPaymentLink(tier: Tier): string | null {
  const v = process.env[tier.envVar];
  if (!v || !v.trim()) return null;
  return v.trim();
}

// Optional fallback contact email shown when no Stripe link is configured.
// Lets us still capture demand by inviting people to email Jan directly.
export function fallbackContactEmail(): string | null {
  const v = process.env.IDEAA_FALLBACK_CONTACT_EMAIL;
  return v && v.trim() ? v.trim() : null;
}
