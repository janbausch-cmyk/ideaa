# Phase A — Demand-Validierung via Stripe Payment Links

Ziel dieser Phase: **erstes echtes Zahlungsbereitschafts-Signal** sammeln, ohne
Auth, Backend-Billing oder Schema-Refactors. Threshold zum Phase-B-Greenlight:
**≥ 3 % paid conversion** (Käufe / unique Ausarbeitungs-Aufrufe Fremder).

## Primär: asymmetrische €1.99-Paywall (IDEAA-72)

Der Hauptzugang in Phase A ist eine **harte Paywall** auf den vollständigen
Validation-Report. Sie ist **asymmetrisch**:

- **Submitter** (gleiche Browser-Session, in der die Idee eingereicht wurde) →
  sieht den vollen Report ohne Bezahlung. Die Server Action `submitIdea`
  setzt für jede frisch eingereichte Idee ein HttpOnly-Cookie
  `ideaa_unlock_<ideaId>=1` (siehe `src/lib/unlock-cookies.ts`).
- **Fremde Besucher** (geteilter Link, Inkognito, anderes Gerät) → sehen nur
  ein Teaser-Snippet (~600 Zeichen) + die `PaywallCard` mit "Für €1,99
  freischalten".

### Cookie-Modell

Ein Cookie pro Idee (`ideaa_unlock_<ideaId>=1`), HttpOnly, SameSite=Lax,
Path=`/`, MaxAge=1 Jahr. Gerätegebunden — Multi-Device-Unlock ist Phase B
(braucht Auth). Wer auf einem neuen Gerät landet, muss ggf. neu zahlen — bei
€1.99 ist das in Phase A akzeptabel.

### Flow

1. Fremder Besucher öffnet `/ideas/{id}` → sieht Teaser + Paywall-Card.
2. Klick auf "Für €1,99 freischalten" → `GET /api/unlock/start?idea={id}`.
3. Wir schreiben einen `cta_events`-Eintrag (`tier=unlock_199`) und 303-en
   zum `STRIPE_PAYMENT_LINK_UNLOCK` mit `?client_reference_id={ideaId}`.
4. User zahlt €1.99 in Stripe.
5. Stripe ruft den Webhook `/api/stripe/webhook` mit
   `checkout.session.completed` auf:
   - Signatur via HMAC-SHA256 verifiziert (`STRIPE_WEBHOOK_SECRET`).
   - Audit-Zeile in `stripe_events` (Idempotenz via `id`).
   - **Eine Zeile in `idea_unlocks`** (Idempotenz via
     `stripe_session_id UNIQUE`).
   - Telegram-Notification bleibt erhalten (siehe unten).
6. Stripe leitet Käufer zu Success-URL:
   `https://<host>/api/unlock/success?session_id={CHECKOUT_SESSION_ID}`.
7. Success-Route schaut `idea_unlocks` per Session-ID nach:
   - Wenn Zeile da → setzt das `ideaa_unlock_<ideaId>` Cookie, redirected
     auf `/ideas/{ideaId}?paid=1`. Voller Report sichtbar.
   - Wenn noch nicht da (Webhook-Race) → kurze HTML-Seite "Zahlung wird
     verbucht…" mit 2-Sekunden-Refresh (max. 15 Versuche ≈ 30s).

### Wichtig

Die Sichtbarkeit ist **gerätegebunden** über das Cookie. Die DB-Zeile
`idea_unlocks` ist nur Audit/Conversion-Ground-Truth — sie alleine entriegelt
keinen Report. Das heißt: wer keine `idea_unlocks`-Zeile mit passender Session
hat (z. B. weil er die Success-URL nie aufgerufen hat), bekommt das Cookie
nicht. Phase B fügt E-Mail-basierte Auth hinzu, damit der Unlock zwischen
Geräten/Browsern wandert.

### Setup für Phase A asymmetrische Paywall

1. Stripe Payment Link für **€1,99 one-time** anlegen.
   - "Collect customer's email" aktivieren.
   - Success URL **explizit** setzen auf:
     `https://<deine-vercel-domain>/api/unlock/success?session_id={CHECKOUT_SESSION_ID}`
     Stripe ersetzt `{CHECKOUT_SESSION_ID}` automatisch nach dem Checkout.
2. Den Payment-Link in Vercel als `STRIPE_PAYMENT_LINK_UNLOCK` hinterlegen.
3. Stripe-Webhook (siehe unten) muss `checkout.session.completed` empfangen —
   das ist beim bestehenden Webhook bereits konfiguriert.

---

## Sekundär: Tier-2/3 Upsell nach Unlock (€25 / €50 / €100)

Diese Karten erscheinen **nur nach** einem Unlock — also für Submitter sofort
und für Käufer nach Bezahlung der €1,99. Sie sind optionale Vertiefungen mit
manueller Lieferung.

| Tier  | Preis | Was der Käufer bekommt                                                                     |
| ----- | ----- | ------------------------------------------------------------------------------------------ |
| €25   | 25 €  | **Tiefer-Analyse** — erweiterte Ausarbeitung der 1 Idee (Zielkunde, Wettbewerb, MVP, GTM). |
| €50   | 50 €  | **Co-Founder-Pitch-Deck** — Slides-Outline (10–12 Slides) + Risk-Storyline.                |
| €100  | 100 € | **Vollberatungs-Stunde** — 60-min 1:1-Call + schriftliche Zusammenfassung.                 |

Alle drei werden **manuell per E-Mail** geliefert (typisch 24–48h).

## Setup-Checkliste (Jan, einmalig)

1. Stripe-Account aktivieren (live mode, Country = DE, IBAN für Auszahlungen).
2. In Stripe → **Payment Links** vier Links erstellen:
   - "IDEAA Volle Analyse freischalten" — 1,99 € (one-time, **primär**)
     - Success URL: `https://<host>/api/unlock/success?session_id={CHECKOUT_SESSION_ID}`
   - "IDEAA Tiefer-Analyse" — 25 € (one-time)
   - "IDEAA Co-Founder-Pitch-Deck" — 50 € (one-time)
   - "IDEAA Vollberatungs-Stunde" — 100 € (one-time)
   - Bei allen "Collect customer's email" aktivieren.
3. Die Payment-Link-URLs in den Vercel-Env-Vars hinterlegen:
   - `STRIPE_PAYMENT_LINK_UNLOCK` (primär, €1,99)
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

## Wie der Tier-2/3-Upsell-Flow im Code läuft

1. Unlocker User öffnet `/ideas/{id}` → Validation Report ist `done`.
2. Unten erscheint der **MonetizationCta**-Block
   (`src/components/MonetizationCta.tsx`) mit den drei höheren Karten.
3. Klick auf eine Karte → `GET /api/cta/{tier}?idea={id}`
   - Schreibt einen Eintrag in `cta_events` (idea_id, tier, UA, referer).
   - 303-Redirect zur Stripe-Payment-Link-URL, mit
     `?client_reference_id={ideaId}` so dass Stripe später die Idee mit dem
     Checkout korreliert.
4. User zahlt bei Stripe.
5. Stripe ruft `POST /api/stripe/webhook` auf:
   - Signatur wird via HMAC-SHA256 verifiziert (`STRIPE_WEBHOOK_SECRET`).
   - Telegram-Nachricht an Jan: Betrag, E-Mail, Idee-ID, Session-ID.
   - Bei einem €1,99-Unlock zusätzlich: eine Zeile in `idea_unlocks`.

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
