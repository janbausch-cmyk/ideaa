<p align="center">
  <img alt="IDEAA" src="../public/peak-wordmark-1200.png" width="360">
</p>

# IDEAA Branding

Logo-Konzept: **Peak** (in [IDEAA-85](../../#)/IDEAA-86 bestätigt).

Die Doppel-A-Spitze ist die Bildmarke — sie greift den Visual-Hook der
Wortmarke (zwei Apex-Punkte am Ende von "IDEA**A**") auf und steht als Symbol
für *Peak / Höchstform einer Idee*.

## Quell-Dateien

Die Master-Vektoren liegen in `logos/svg/`:

| Datei | Verwendung |
| --- | --- |
| `concept-3-peak-wordmark.svg` | Farb-Wortmarke (Dark-Green `#0F4C3A`) |
| `concept-3-peak-wordmark-mono.svg` | Mono-Wortmarke (`#0A0A0A` bzw. recolorable) |
| `concept-3-peak-mark.svg` | Bildmarke (nur Doppel-A) |
| `concept-3-peak-mark-mono.svg` | Mono-Bildmarke |

PNG-Renderings (16/32/256, OG 1200×630, Wortmarke 1200) in `logos/png/`.

Rebuild Master-PNGs:

```bash
node branding/logos/generate.mjs
```

Rebuild Produkt-Assets (Favicon, OG-Image, Apple-Icon, Telegram-Avatar, etc.):

```bash
node branding/logos/rollout-assets.mjs
```

## Farben

| Token | Wert | Verwendung |
| --- | --- | --- |
| Peak Green | `#0F4C3A` | Farbvariante auf hellem Hintergrund |
| Peak Mono Light | `#F5F5F4` | Wortmarke auf dunklem/farbigem BG |
| Peak Mono Dark | `#0A0A0A` | Wortmarke auf hellem BG, wenn neutral gewünscht |

CSS-Variable `--brand-peak` ist NICHT separat definiert; stattdessen nutzt der
React-Layer die Klasse `.brand-peak` (siehe `src/app/globals.css`) mit
automatischem Dark-Mode-Switch via `prefers-color-scheme`.

## Wann Farb- vs. Mono-Variante?

- **Farbe (Peak Green)** auf neutralen, hellen Hintergründen — Homepage-Header,
  README, Light-Mode-Browser-Tab, Light-Mode-OG-Card.
- **Mono Light (weiss)** auf farbigen oder dunklen Hintergründen — Dark-Mode,
  Marketing-Material mit Foto-BG, Footer-Bars.
- **Mono Dark (schwarz)** nur wenn die Marke neutral wirken soll und Farbe
  visuellen Lärm erzeugen würde (z.B. Print-S/W).

## Mindestabstände

- Wortmarke: Padding ≥ 20px (= H-Stroke-Width) auf allen Seiten zur nächsten
  visuellen Kante.
- Bildmarke: Padding ≥ 12% der Symbol-Breite.
- Wortmarke nie kleiner als 80px Breite rendern (Lesbarkeit der "A"-Apex-Kurven).
- Bildmarke nie kleiner als 16px rendern (unter dieser Schwelle die Favicon-ICO
  nutzen, die bereits gepixelt-optimiert ist).

## Wo das Logo im Produkt sitzt

Generiert via `branding/logos/rollout-assets.mjs`:

| Pfad | Zweck |
| --- | --- |
| `src/app/favicon.ico` | Multi-Size ICO (16/32/48) – Browser-Tab |
| `src/app/icon.svg` | Skalierbare Bildmarke für moderne Browser |
| `src/app/apple-icon.png` | 180×180 iOS Home-Screen-Icon |
| `src/app/opengraph-image.png` | 1200×630 Social Card (auto-tagged von Next 16) |
| `src/app/twitter-image.png` | 1200×630 Twitter Card |
| `public/peak-wordmark-color.svg` | Wortmarke (grün) für Marketing/Embeds |
| `public/peak-wordmark-mono-*.svg` | Mono-Varianten |
| `public/peak-wordmark-1200.png` | README-Hero (light) |
| `public/peak-wordmark-1200-dark.png` | README-Hero (dark) |
| `branding/telegram-avatar.png` | 256×256 Avatar für `@ideaa_bot` |

Inline-React-Komponenten (currentColor, themable):

- `src/components/BrandWordmark.tsx`
- `src/components/BrandMark.tsx`

## Telegram-Bot-Avatar

`branding/telegram-avatar.png` (256×256, weisser Hintergrund, dunkelgrüne
Bildmarke zentriert).

**Setzen via BotFather (manuell, weil wir den Bot-Token nicht via API
besitzen):**

1. In Telegram `@BotFather` öffnen.
2. `/setuserpic` → `@ideaa_bot` (oder Bot-Username) auswählen.
3. `branding/telegram-avatar.png` hochladen.
4. BotFather bestätigt mit "Success! Bot ... botpic updated."

Re-Generierung des Avatars: `node branding/logos/rollout-assets.mjs`.
