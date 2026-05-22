// IDEAA-69 Phase A: pay-button block shown at the end of the public
// Ausarbeitungs-Output. Only tiers with a configured Stripe Payment Link are
// rendered — un-set tiers stay hidden so the surface scales as Jan adds
// links, without ever showing dead "Bald" placeholders.

import { TIERS, tierPaymentLink } from "@/lib/monetization";

export default function MonetizationCta({ ideaId }: { ideaId: string }) {
  const activeTiers = TIERS.filter((tier) => tierPaymentLink(tier) !== null);
  if (activeTiers.length === 0) return null;

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
          Optionale Vertiefung dieser Ausarbeitung — keine Anmeldung nötig, du
          zahlst direkt via Stripe.
        </p>
      </div>
      <div className="flex flex-wrap gap-4">
        {activeTiers.map((tier) => (
          <a
            key={tier.id}
            href={`/api/cta/${tier.id}?idea=${encodeURIComponent(ideaId)}`}
            rel="nofollow noopener"
            className="group flex min-w-[260px] max-w-sm flex-1 flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--brand-ink)]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ink)]/30"
          >
            <span className="text-2xl font-bold tracking-tight text-[color:var(--foreground)]">
              €{tier.priceEuro}
            </span>
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
              Jetzt buchen
              <span aria-hidden>→</span>
            </span>
          </a>
        ))}
      </div>
      <p className="text-xs text-[color:var(--foreground-muted)]">
        Lieferung manuell per E-Mail (typisch 24–48h). Keine Daten werden
        gespeichert außer dem anonymen Klick-Zähler.
      </p>
    </section>
  );
}
