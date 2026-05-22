// IDEAA-69 Phase A: pay-button block shown at the end of the public
// Ausarbeitungs-Output. Three tier cards link through /api/cta/[tier], which
// records the click then 303-redirects to the configured Stripe Payment Link.

import { TIERS, tierPaymentLink } from "@/lib/monetization";

export default function MonetizationCta({ ideaId }: { ideaId: string }) {
  return (
    <section
      className="no-print surface-card flex flex-col gap-5 p-6 sm:p-7"
      aria-labelledby="cta-heading"
    >
      <div className="flex flex-col gap-1">
        <h2 id="cta-heading" className="eyebrow">
          Brauchst du mehr Tiefe?
        </h2>
        <p className="text-sm text-[color:var(--foreground-muted)]">
          Drei optionale Bausteine, die manuell von Jan geliefert werden — keine
          Anmeldung nötig. Du zahlst direkt via Stripe.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => {
          const linkActive = !!tierPaymentLink(tier);
          return (
            <a
              key={tier.id}
              href={`/api/cta/${tier.id}?idea=${encodeURIComponent(ideaId)}`}
              rel="nofollow noopener"
              className="group flex flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--brand-ink)]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ink)]/30"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold tracking-tight text-[color:var(--foreground)]">
                  €{tier.priceEuro}
                </span>
                {linkActive ? null : (
                  <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[color:var(--foreground-muted)]">
                    Bald
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-[color:var(--foreground)]">
                  {tier.title}
                </h3>
                <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--foreground-muted)]">
                  {tier.tagline}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-[color:var(--foreground-muted)]">
                {tier.blurb}
              </p>
              <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ink)]">
                {linkActive ? "Jetzt buchen" : "Interesse zeigen"}
                <span aria-hidden>→</span>
              </span>
            </a>
          );
        })}
      </div>
      <p className="text-xs text-[color:var(--foreground-muted)]">
        Phase A: Lieferung manuell per E-Mail (typisch 24–48h). Keine Daten
        werden gespeichert außer dem anonymen Klick-Zähler.
      </p>
    </section>
  );
}
