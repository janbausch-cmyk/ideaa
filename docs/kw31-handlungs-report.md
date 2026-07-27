# IDEAA Handlungs-Report – KW 31 (2026-07-27)

Basis: Wöchentlicher Positionierungs-Bericht KW 31 + Live-Scrape von ideecheck.ai.

---

## Die Essenz in einem Absatz

Der Markt polarisiert sich: **kostenlos + schnell** (IdeaProof, Preuve Free) auf der einen, **einmalig teuer + tief** (DimeADozen $129/$179 One-Time, 150+ Seiten) auf der anderen Seite. Preuve AI setzt gerade den neuen Tischstandard mit **Live-Quellenverlinkung + Agent-API + MCP-Server**. Im D/A/CH-Kernkeyword „Geschäftsidee validieren" sitzt **ideecheck.ai** schon mit sauber gestaffeltem Angebot (0 € / 12,90 € / 39,90 €) und Blog-Historie. IDEAAs derzeitige Position „monatliches Abo für Solo-Founder, 60–90 s Report" ist genau die schwächste Nische zwischen den Polen — ohne Quellen wirkt es 2024er, ohne Umsetzungsplan austauschbar.

---

## Was wir sofort besser machen müssen (Prio-Reihenfolge)

### 1. Quellen-Verlinkung im Report (P0, blockiert alles andere)
Jede Marktzahl, jeder Wettbewerber-Fakt bekommt einen klickbaren Link. Ohne das verlieren wir jeden Head-to-Head-Vergleich gegen Preuve/DimeADozen automatisch. Umsetzung: Modell-Output um `{claim, source_url, retrieved_at}`-Struktur erweitern, im PDF/Web-Report als Fußnoten rendern.

### 2. Pricing-Reset weg vom Solo-Abo (P0)
Aktuelles Monats-Abo ist die schwächste Marktposition. Vorschlag angelehnt an DimeADozen + ideecheck:
- **Free SchnellCheck** — Score + größtes Risiko, kein Login-Zwang.
- **One-Time ProReport** — €14,90 (Anker €24,90 durchgestrichen), voller Report + Umsetzungsplan.
- **One-Time TiefenReport** — €49–79, inklusive Interview-Skripte + Landingpage-Bausteine.
- Optional: **3-Pack Bundle** für Serien-Founder (DimeADozen-Modell).
Credits verfallen nie. Abo nur für Coaches/Corporates behalten.

### 3. Umsetzungsplan als Alleinstellungsmerkmal (P0)
Das ist die *einzige* freie Positionierung im D/A/CH-Markt: Kein Konkurrent liefert nach dem Report **konkrete nächste Schritte** — Interview-Skripte für die ersten 5 Zielkunden, Landingpage-Copy-Baukasten, Waitlist-Template, erste 3 Ad-Varianten. Ideecheck hört beim Score auf, DimeADozen liefert nur ein statisches Dokument. Genau hier positionieren: **„Nicht nur wissen, ob deine Idee tragfähig ist — sondern morgen loslegen können."**

### 4. „Ehrlich statt ermutigend" als Marken-Ton (P1)
ValidatorAI wird in Vergleichs-Reviews als zu positiv abgestraft. IDEAA-Report soll standardmäßig einen **„Nicht bauen"-Fall** ausweisen können, mit klarer Begründung. Das trifft auch den [[feedback_humanizer_copy]]-Ton. Beispiel-Sektion im Report: *„Warum wir dir hier abraten würden"*.

### 5. Agent-native Endpoint (P1, ~2 Tage Aufwand)
Simple `POST /api/validate` mit JSON-Response (`score`, `report_url`, `top_risk`, `sources[]`). Reine Positionierungs-Maßnahme, damit wir in „AI-nativen Tools"-Listen auftauchen. Signed HMAC + Rate-Limit reicht fürs Erste, MCP kann später kommen.

### 6. Vergleichsseite (P1)
**„IDEAA vs ChatGPT vs IdeeCheck.ai vs Preuve"** — ehrliches Feature-Grid, IDEAA *nicht* auf Platz 1 in jeder Zeile. Ehrliche Comparisons ranken nachweislich besser als Selbstlob und ziehen Käufer-Traffic. Empfohlener Winkel: *„D/A/CH + Umsetzungsplan → IDEAA. Investoren-Deck 200 Seiten → DimeADozen."*

### 7. SEO-Landingpage „Geschäftsidee validieren in 90 Sekunden" (P1)
Schlägt Ideecheck-Guide, indem sie sofort in den Report führt statt in einen 4-Minuten-Lesetext. Direkt konvertieren, nicht erst edukieren.

### 8. Sofort-Trafficspike diese Woche (P2, quick win)
YC Fall 2026 RFS haben 13 offene Ideen (Deadline 27. Juli — heute!). IDEAA über alle 13 laufen lassen, als Sammlung **„So bewertet IDEAA die YC Fall 2026 RFS"** publizieren. Twitter/X + Indie Hackers + LinkedIn. Kostet einen Tag, Reichweitenfenster geht diese Woche zu.

### 9. Outreach it-boltwise.de (P2)
Die schreiben seit Juni aktiv über KI + Kundeninterviews + Startup-Hypothesen. Genau unsere Zielgruppe. Gastbeitrag-Pitch: *„Wo KI-Validierung aufhört und Kundeninterviews anfangen"* — bringt beides ins Blickfeld (Validierungs-Report → Umsetzungsplan mit Interview-Skripten).

---

## Was wir von ideecheck.ai konkret klauen sollten

| Element bei ideecheck | Warum stark | IDEAA-Übertrag |
|---|---|---|
| Preisanker mit durchgestrichenem Ursprungspreis (€19,90 → €12,90) | Erhöht CTR auf CTA messbar | In neuen Pricing-Reset einbauen |
| Klar getrennte Zielgruppen (Gründer / Förderstellen / Coaches / Corporates) | Jede Zielgruppe hat eigene Value-Prop-Seite | 4 Landingpages statt einer Homepage |
| Öffentlicher Beispiel-Report | Senkt Kaufhürde radikal | Ein „echter" IDEAA-Report als Public URL, indexierbar |
| Explizite 5-Schritte-Methodik | Wirkt strukturiert, verkauft Ernsthaftigkeit | Unsere Methodik-Seite bauen, Icons + Ablauf |
| Sicherheits-/DSGVO-Trust-Sektion (EU-Hosting Frankfurt, AES-256, ISO 27001, kein KI-Training) | D/A/CH-Käufer klicken das an | Eigene Trust-Seite + Badge im Checkout — passt auch zum [[feedback_dsgvo_reflex]] |
| Gründerwissen-Blog wöchentlich | SEO-Long-Tail für D/A/CH-Keywords | Redaktionskalender, ein Beitrag/Woche zu einem Kernkeyword |
| EnterpriseCheck (Bulk, API, White-Label, SSO) angekündigt | Signalisiert Reife, sammelt Enterprise-Leads | „Enterprise Waitlist"-Seite mit den gleichen 4 Bulletpoints |
| „€5.000+ Marktberatung"-Anker | Value-Framing statt Feature-Framing | Eigenen Anker finden — z.B. „Ersetzt 2 Tage Berater-Workshop" |

---

## Was wir NICHT von ideecheck übernehmen

- Statische 13-teilige PDF-Reports ohne Interaktivität → **unser Vorteil ist das Umsetzungsartefakt, nicht die Report-Länge.**
- „Investment-Grade"-Framing → Solo-Founder fühlen sich davon nicht angesprochen, das ist Coach-Sprache.
- Fehlen von Community/Netzwerk → hier haben *wir* die Chance, später einen Waitlist-/Peer-Review-Layer draufzusetzen, den keiner der US-Player im D/A/CH-Markt hat.

---

## Konkreter Wochenplan KW 31/32

**Diese Woche (bis 2026-08-03):**
- [ ] YC RFS 13-Reports produzieren + veröffentlichen (Tag 1)
- [ ] Pricing-Seite umbauen auf Free + One-Time (Tag 2–3)
- [ ] Public Sample-Report live (Tag 3)
- [ ] Quellen-Verlinkung im Report-Backend spec'en (Tag 4–5)

**KW 32:**
- [ ] Quellen-Rendering im PDF live
- [ ] Vergleichsseite „IDEAA vs ideecheck vs Preuve" publiziert
- [ ] `/api/validate` Endpoint als MVP
- [ ] Outreach-Mail an it-boltwise.de raus

---

## Offene Entscheidungen für dich

1. **Pricing-Höhe:** €14,90 One-Time ProReport oder aggressiver bei €9,90 einsteigen (DimeADozen-Starter-Anker)?
2. **Solo-Abo abschaffen oder migrieren?** Bestehende Abonnenten bekommen was?
3. **Umsetzungsplan-Bausteine:** Was priorisieren — Interview-Skripte, Landing-Copy, Ads, oder Waitlist-Template?
4. **YC-Report-Sprint:** Baust du die Reports selbst durchs Tool oder soll ich dir dabei helfen?
