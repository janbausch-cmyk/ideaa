# Phase A — Demand-Validierung via Stripe Payment Links

Ziel dieser Phase: **erstes echtes Zahlungsbereitschafts-Signal** sammeln, ohne
Auth, Backend-Billing oder Schema-Refactors. Threshold zum Phase-B-Greenlight:
**≥ 3 % paid conversion** (Käufe / unique Ausarbeitungs-Aufrufe).

## Preisstruktur

| Tier  | Preis | Was der Käufer bekommt                                                                     |
| ----- | ----- | ------------------------------------------------------------------------------------------ |
| €25   | 25 €  | **Tiefer-Analyse** — erweiterte Ausarbeitung der 1 Idee (Zielkunde, Wettbewerb, MVP, GTM). |
| €50   | 50 €  | **Co-Founder-Pitch-Deck** — Slides-Outline (10–12 Slides) + Risk-Storyline.                |
| €100  | 100 € | **Vollberatungs-Stunde** — 60-min 1:1-Call + schriftliche Zusammenfassung.                 |

Alle drei werden **manuell per E-Mail** geliefert (typisch 24–48h).

## Setup-Checkliste (Jan, einmalig)

1. Stripe-Account aktivieren (live mode, Country = DE, IBAN für Auszahlungen).
2. In Stripe → **Payment Links** drei Links erstellen:
   - "IDEAA Tiefer-Analyse" — 25 € (one-time)
   - "IDEAA Co-Founder-Pitch-Deck" — 50 € (one-time)
   - "IDEAA Vollberatungs-Stunde" — 100 € (one-time)
   - "Collect customer's email" aktivieren (für die manuelle Lieferung).
3. Die drei Payment-Link-URLs in den Vercel-Env-Vars hinterlegen:
   - `STRIPE_PAYMENT_LINK_25`
   - `STRIPE_PAYMENT_LINK_50`
   - `STRIPE_PAYMENT_LINK_100`
4. Stripe → **Developers → Webhooks** → Endpoint hinzufügen:
   - URL: `https://<deine-vercel-domain>/api/stripe/webhook`
   - Events: `checkout.session.completed`,
     `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`
   - Den **Signing Secret** (`whsec_…`) als Env-Var `STRIPE_WEBHOOK_SECRET` setzen.
5. Optional: `IDEAA_NOTIFY_TELEGRAM_CHAT_ID` setzen (sonst geht die
   Benachrichtigung an den ersten Eintrag aus `TELEGRAM_ALLOWED_USER_IDS`).
6. Optional: `IDEAA_FALLBACK_CONTACT_EMAIL=jan@example.com` setzen — wenn ein
   Stripe-Link fehlt, fällt die Karte auf eine `mailto:`-Aktion zurück, damit
   Demand-Signal nicht verloren geht.

## Wie der Flow im Code läuft

1. User öffnet `/ideas/{id}` → Validation Report ist `done`.
2. Unten erscheint der **MonetizationCta**-Block (`src/components/MonetizationCta.tsx`)
   mit drei Karten.
3. Klick auf eine Karte → `GET /api/cta/{tier}?idea={id}`
   - Schreibt einen Eintrag in `cta_events` (idea_id, tier, UA, referer).
   - 303-Redirect zur Stripe-Payment-Link-URL, mit
     `?client_reference_id={ideaId}` so dass Stripe später die Idee mit dem
     Checkout korreliert.
4. User zahlt bei Stripe.
5. Stripe ruft `POST /api/stripe/webhook` auf:
   - Signatur wird via HMAC-SHA256 verifiziert (`STRIPE_WEBHOOK_SECRET`).
   - Telegram-Nachricht an Jan: Betrag, E-Mail, Idee-ID, Session-ID.

## Lieferprozess (Jan, pro eingehendem Kauf)

1. Telegram pingt — Betrag + Käufer-E-Mail + Idee-ID stehen drin.
2. In Stripe dashboard die Session öffnen (Session-ID aus der Nachricht), um
   die volle Käuferzeile zu sehen.
3. Idee unter `/admin/ideas/{id}` öffnen.
4. Je nach Tier:
   - **€25:** "Idee ausarbeiten" klicken → das generierte Deepdive-Markdown
     an Käufer-E-Mail mailen.
   - **€50:** Slides-Outline + Risk-Storyline manuell aus dem Deepdive
     destillieren (ChatGPT-Skizze ok), E-Mail.
   - **€100:** Calendly/Direkt-Mail mit Terminvorschlägen für den Call.
5. Im Notiz-Feld der Idee festhalten: `[paid €X – delivered YYYY-MM-DD]`.

## Conversion-Tracking & Greenlight

- **Klick-Zahlen**: `SELECT tier, count(*) FROM cta_events GROUP BY tier;`
- **Kauf-Zahlen**: Stripe Dashboard → Reports → Net volume per Payment Link.
- **Conversion-Rate**: Käufe / unique `cta_events` pro Tier.
- **Greenlight für Phase B**: ≥ 3 % paid conversion über mind. 10 Käufe.

## Bewusste Auslassungen

- Keine Auth / kein Login. Käufer-Identität läuft nur über Stripe-E-Mail.
- Keine automatisierte Lieferung. Volumen ist im Phase-A-Bereich klein genug
  für manuell — und die Lernrate aus manuellem Versand ist höher.
- Kein DB-Schema für "purchases". Stripe ist die Source of Truth.
- Kein PDF-Export, kein Library-View, keine Abos. Alles Phase B, wenn die
  3-%-Schwelle erreicht ist.
