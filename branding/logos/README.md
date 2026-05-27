# IDEAA Logo-Konzepte (Phase 1 — IDEAA-85)

Vier verschiedene Konzept-Richtungen für die IDEAA-Identität. Alle Buchstaben
sind handgezeichnete SVG-Pfade (keine Systemschrift), d.h. die Wortmarke ist
in keiner gängigen Schrift verfügbar — gut für Google-Distinct-Sein.

Pro Konzept gibt es:

- `svg/concept-N-<slug>-wordmark.svg` — volle Wortmarke (Farbe)
- `svg/concept-N-<slug>-wordmark-mono.svg` — Mono-Variante (single color)
- `svg/concept-N-<slug>-mark.svg` — Bildmarke / Favicon-Glyph (Farbe)
- `svg/concept-N-<slug>-mark-mono.svg` — Mono-Variante
- `png/concept-N-<slug>-mark-{16,32,256}.png` — Favicon-Renderings
- `png/concept-N-<slug>-mark-mono-256.png` — Mono 256
- `png/concept-N-<slug>-wordmark-1200.png` — Wortmarke 1200px breit
- `png/concept-N-<slug>-og-1200x630.png` — OG-Card 1200×630

Regeneration: `node branding/logos/generate.mjs` (benötigt sharp aus den Repo-Dependencies).

---

## Konzept 1 — "Brücke" (Bridge AA)

**Pitch:** Die zwei As in IDE**AA** werden durch einen Bogen verbunden — eine
visuelle Brücke von Rohidee zu strukturiertem Plan. Die typografische
Doppel-A-Ligatur ist sofort erkennbar und nicht durch eine Standard-Schrift
reproduzierbar.

- **Farbe:** Indigo `#1B1F4B` + warmer Sand-Akzent `#F4A523`
- **Bildmarke:** zwei As mit dem Brücken-Bogen darüber, isolierbar als Favicon
- **Distinkt-Check:** Verbundene AA-Ligaturen sind in Tech-Logos selten; der
  Bogen liest sich als Brücke (nicht als Lächeln, nicht als U). Risiko: bei
  16×16 verlieren die inneren Dreieck-Aussparungen Detail — bleibt aber als
  Doppel-Glyph-Silhouette mit oranger Brücke erkennbar.

## Konzept 2 — "Rahmen" (Idea Frame)

**Pitch:** Ein quadratischer Rahmen mit einer Lücke in der oberen linken Ecke;
ein roter Punkt tritt durch die Lücke ein. Bedeutung: rohe Idee wird in eine
strukturierte Form überführt. Bewusst geometrisch-redaktionell, kein AI-Sparkle.

- **Farbe:** Schwarz `#0A0A0A` + Vermilion-Akzent `#E63946`
- **Bildmarke:** der unterbrochene Rahmen + Punkt, robust bis 32×32
- **Distinkt-Check:** "Rahmen mit Loch + Punkt" ist als Kombi nicht
  überstrapaziert. Reine Quadrat-Rahmen sind häufig (viele Brand-Logos), aber
  die offene Ecke + farbiger Punkt erzeugen ein eigenes Silhouetten-Profil.
  Risiko der Verwechslung mit Notiz-/Sticky-Apps.

## Konzept 3 — "Peak" (Doppel-Peak)

**Pitch:** Die beiden As werden zu zwei gerundeten Bergpeaks (ohne Querbalken).
Steht für die Spitze einer ausgearbeiteten Einsicht — das Ergebnis, das IDEAA
liefert. Die Modifikation betrifft nur die AAs, sodass "IDE" lesbar bleibt und
die AAs gleichzeitig als eigene Bildmarke funktionieren.

- **Farbe:** Forest `#0F4C3A` + Akzent Burnt-Orange `#D97032`
- **Bildmarke:** zwei zusammenstehende Peaks, sehr distinkte Silhouette
- **Distinkt-Check:** Peaks/Berge sind als Tech-Logo häufig (Outdoor-Brands,
  Crypto-Wallets). Distinktion entsteht durch die ungewöhnliche Doppelung
  (zwei Peaks dicht beieinander, nicht ein Massiv) und die direkte Verkopplung
  mit den As der Wortmarke. Risiko: Outdoor-Assoziation.

## Konzept 4 — "Sequenz" (Spark → Plan)

**Pitch:** Drei horizontale Glyphen — gelber Punkt, kurzer Balken, offenes
Quadrat — visualisieren den Prozess Rohidee → Analyse → strukturierter Plan.
Direkteste Übersetzung der IDEAA-Mission ins Visuelle.

- **Farbe:** Tiefes Violett `#3F1D9E` + Akzent Yellow `#F5C518`
- **Bildmarke:** die drei sequentiellen Elemente, lesbar als kleine Zeile
- **Distinkt-Check:** Sequenz-Glyphen sind in Process-Tools verbreitet
  (Workflow-/BPM-Logos), aber die spezifische Form Punkt+Balken+offenes
  Quadrat ist als Kombi nicht dominant in den Suchergebnissen für "IDEAA".
  Risiko: kann ohne Wortmarke abstrakt wirken (eher Companion-Mark als
  alleinstehendes Symbol).

---

## Nicht-Ziele (Phase 1)

- Keine Implementierung in App-Code (kein Favicon-Replace, kein Header-Update).
- Keine bezahlten Stock-Schriften.
- Keine externen Posts.

Folgetask (separates Issue) nach Jans Auswahl: Produktionsreifes Favicon-Set,
App-Header-Logo, OG-Image-Ersatz, Telegram-Avatar, README-Branding.
