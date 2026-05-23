// IDEAA-72 Phase A: asymmetric paywall card shown to non-submitters on the
// public Ausarbeitungs-Seite. Links to /api/unlock/start which redirects to
// the €1.99 Stripe Payment Link and logs the demand event.

import { UNLOCK_PRICE_EURO } from "@/lib/monetization";

export default function PaywallCard({ ideaId }: { ideaId: string }) {
  const price = UNLOCK_PRICE_EURO.toFixed(2).replace(".", ",");
  return (
    <section
      className="no-print surface-card flex flex-col gap-5 p-6 sm:p-7"
      aria-labelledby="paywall-heading"
    >
      <div className="flex flex-col gap-1">
        <span className="eyebrow">Volle Analyse gesperrt</span>
        <h2
          id="paywall-heading"
          className="text-2xl font-bold tracking-tight text-[color:var(--foreground)]"
        >
          Schalte den vollständigen Validation-Report für €{price} frei
        </h2>
        <p className="text-sm text-[color:var(--foreground-muted)]">
          Du hast die Idee nicht selbst eingereicht — der vollständige Bericht
          (Markt, Wettbewerb, MVP-Skizze, GTM-Wedge, 30/60/90, Risiken, Plan)
          ist hinter einer Mini-Paywall. Einmalig, kein Abo, keine Anmeldung.
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm text-[color:var(--foreground)]">
        <li>✓ Vollständige Validation-Sektionen (1–6)</li>
        <li>✓ Umsetzungsplan (30/60/90)</li>
        <li>✓ Risiken & Kill-Criteria</li>
        <li>✓ Sofort sichtbar nach Bezahlung</li>
      </ul>
      <div className="flex flex-wrap items-center gap-4">
        <a
          href={`/api/unlock/start?idea=${encodeURIComponent(ideaId)}`}
          rel="nofollow noopener"
          className="brand-button inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          Für €{price} freischalten
          <span aria-hidden>→</span>
        </a>
        <span className="text-xs text-[color:var(--foreground-muted)]">
          Sichere Zahlung über Stripe. Freischaltung gilt für dieses Gerät.
        </span>
      </div>
    </section>
  );
}
