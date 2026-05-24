# Phase A — Demand-Validierung via €1.99-Paywall

Ziel dieser Phase: **erstes echtes Zahlungsbereitschafts-Signal** sammeln, ohne
Auth, Backend-Billing oder Schema-Refactors. Threshold zum Phase-B-Greenlight:
**≥ 3 % paid conversion** (Käufe / unique Ausarbeitungs-Aufrufe Fremder).

Single-Tier-Funnel: nur die €1,99-Freischaltung. Tier-2/3 (€25/€50/€100 aus dem
ursprünglichen IDEAA-69-Scope) wurden bewusst entfernt — vager Upsell verwischt
das Phase-A-Signal. Datengetriebene Higher-Tier-CTAs kommen frühestens nach dem
Greenlight.

## Asymmetrische Paywall (IDEAA-72)

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
€1,99 ist das in Phase A akzeptabel.

### Flow

1. Fremder Besucher öffnet `/ideas/{id}` → sieht Teaser + Paywall-Card.
2. Klick auf "Für €1,99 freischalten" → `GET /api/unlock/start?idea={id}`.
3. Wir schreiben einen `cta_events`-Eintrag (`tier=unlock_199`) und 303-en
   zum `STRIPE_PAYMENT_LINK_UNLOCK` mit `?client_reference_id={ideaId}`.
4. User zahlt €1,99 in Stripe.
5. Stripe ruft den Webhook `/api/stripe/webhook` mit
   `checkout.session.completed` auf:
   - Signatur via HMAC-SHA256 verifiziert (`STRIPE_WEBHOOK_SECRET`).
   - Audit-Zeile in `stripe_events` (Idempotenz via `id`).
   - **Eine Zeile in `idea_unlocks`** (Idempotenz via
     `stripe_session_id UNIQUE`).
   - Telegram-Notification an Jan ("💶 IDEAA Phase A — Kauf eingegangen!").
6. Stripe leitet Käufer zur Success-URL:
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
hat (z. B. weil die Stripe-Success-URL nicht auf `/api/unlock/success` zeigt),
bekommt das Cookie nicht. Phase B fügt E-Mail-basierte Auth hinzu, damit der
Unlock zwischen Geräten/Browsern wandert.

## Setup-Checkliste (Jan, einmalig)

1. Stripe-Account aktivieren (Country = DE, IBAN für Auszahlungen).
2. Stripe → **Payment Links** → neuen Link erstellen:
   - "IDEAA Volle Analyse freischalten" — 1,99 € (one-time).
   - "Collect customer's email" aktivieren.
   - **After payment → "Redirect customers to your website"** mit URL
     (wörtlich inkl. `{CHECKOUT_SESSION_ID}`-Platzhalter):
     ```
     https://<deine-vercel-domain>/api/unlock/success?session_id={CHECKOUT_SESSION_ID}
     ```
     Ohne diesen Redirect kann der Käufer den Unlock auf seinem Gerät nicht
     bekommen — die Zahlung greift, aber der Cookie wird nie gesetzt.
3. Die Payment-Link-URL in Vercel als `STRIPE_PAYMENT_LINK_UNLOCK` hinterlegen.
4. Stripe → **Developers → Webhooks** → Endpoint hinzufügen:
   - URL: `https://<deine-vercel-domain>/api/stripe/webhook`
   - Events: `checkout.session.completed`,
     `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`.
   - Den **Signing Secret** (`whsec_…`) als Env-Var `STRIPE_WEBHOOK_SECRET`
     setzen.
5. Optional: `IDEAA_NOTIFY_TELEGRAM_CHAT_ID` setzen (sonst geht die
   Benachrichtigung an den ersten Eintrag aus `TELEGRAM_ALLOWED_USER_IDS`).
6. Optional: `IDEAA_FALLBACK_CONTACT_EMAIL=jan@example.com` als Demand-Capture
   für andere Fallback-Pfade.

## Setup-Verifikation

```
$ curl -s https://<host>/api/health | jq '.env'
{
  "has_stripe_payment_link_unlock": true,   ← muss true sein
  "has_stripe_webhook_secret":      true,
  ...
}
```

Wenn `has_stripe_payment_link_unlock: false`, rendert `PaywallCard` einen
sichtbaren "Bezahl-Freischaltung wird gerade aktiviert"-Hinweis statt eines
toten Buttons.

## Conversion-Tracking & Greenlight

- **Klick-Zahlen**:
  `SELECT count(*) FROM cta_events WHERE tier = 'unlock_199';`
- **Kauf-Zahlen**: Stripe Dashboard → Reports oder
  `SELECT count(*) FROM idea_unlocks;`
- **Conversion-Rate**: `idea_unlocks` / `cta_events.tier='unlock_199'`.
- **Greenlight für Phase B**: ≥ 3 % paid conversion über mind. 10 Käufe.

## Bewusste Auslassungen

- Keine Auth / kein Login. Käufer-Identität läuft nur über Stripe-E-Mail.
- Kein PDF-Export, kein Library-View, keine Abos. Alles Phase B, wenn die
  3-%-Schwelle erreicht ist.
- Multi-Device-Unlock — Cookie ist gerätegebunden. Phase B mit Auth.
- Höhere Tiers (€25/€50/€100) bewusst entfernt — Phase A misst einen
  einzelnen Funnel; ein datengetriebener Upsell-Tier folgt nach Greenlight.
