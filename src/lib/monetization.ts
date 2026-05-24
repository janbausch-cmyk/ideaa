// IDEAA-72 Phase A: asymmetric paywall on the full Ausarbeitung. €1.99 one-time
// unlock per idea. Submitters (cookie from submit flow) bypass; strangers see
// teaser + paywall card. Tier-2/3 upsell (€25/€50/€100) from IDEAA-69 was
// retired so Phase A measures a clean single-tier conversion rate.

export const UNLOCK_PRICE_EURO = 1.99;
export const UNLOCK_PRICE_MINOR = 199;
export const UNLOCK_TIER_ID = "unlock_199";

export function unlockPaymentLink(): string | null {
  const v = process.env.STRIPE_PAYMENT_LINK_UNLOCK;
  return v && v.trim() ? v.trim() : null;
}

// Optional fallback contact email surfaced when no Stripe link is configured.
// Lets us still capture demand by inviting people to email Jan directly.
export function fallbackContactEmail(): string | null {
  const v = process.env.IDEAA_FALLBACK_CONTACT_EMAIL;
  return v && v.trim() ? v.trim() : null;
}
