// IDEAA Logo-Generator
// Erzeugt 4 Konzepte als SVG (Wortmarke, Bildmarke, Mono-Varianten)
// und rendert PNGs in 16/32/256 sowie 1200x630 OG-Cards via sharp.
//
// Buchstabengeometrie ist handgezeichnet (Pfad-basiert), damit
// keine Schriftarten benötigt werden und das Lettering distinkt ist.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SVG_DIR = path.join(__dirname, "svg");
const PNG_DIR = path.join(__dirname, "png");

// ---------- Geometrie der Buchstaben "IDEAA" ----------
// Cap-Height 120, Stroke 22, A/D-Breite 88, E-Breite 80, I-Breite 22, Gap 28.

const H = 120;
const S = 22;
const W_A = 88;
const W_D = 88;
const W_E = 80;
const W_I = 22;
const G = 28;

// Buchstaben-Pfade (relativ zu x=0, y=0)
const LETTER = {
  I: () => `M 0 0 H ${W_I} V ${H} H 0 Z`,
  D: () => {
    // Linker Balken + Halb-Stadion-Kurve mit innerem Loch
    return [
      // Aussen (im Uhrzeigersinn)
      `M 0 0`,
      `L 46 0`,
      `C 71 0 ${W_D} 27 ${W_D} 60`,
      `C ${W_D} 93 71 120 46 120`,
      `L 0 120 Z`,
      // Innen (gegen den Uhrzeigersinn => Loch via evenodd)
      `M ${S} ${S}`,
      `L 46 ${S}`,
      `C 58 ${S} 66 40 66 60`,
      `C 66 80 58 98 46 98`,
      `L ${S} 98 Z`,
    ].join(" ");
  },
  E: () => {
    // Linker Balken + 3 horizontale Balken
    return [
      `M 0 0 H ${W_E} V ${S} H ${S} V 49 H 72 V ${49 + S} H ${S} V ${H - S} H ${W_E} V ${H} H 0 Z`,
    ].join(" ");
  },
  // Standard-A: spitzer Apex, mit Querbalken
  A: () => {
    return [
      `M 0 ${H} L 44 0 L ${W_A} ${H} L 66 ${H} L 60 95 L 28 95 L 22 ${H} Z`,
      `M 33 78 L 55 78 L 44 32 Z`,
    ].join(" ");
  },
  // Peak-A: oben abgerundeter Apex, kein Querbalken (Konzept 3)
  A_PEAK: () => {
    // Aussen: linker Diagonal-Stroke, runder Apex, rechter Diagonal-Stroke,
    // Bodenkante.
    return [
      `M 0 ${H}`,
      `L 30 24`,
      // runder Apex
      `Q 44 -6 58 24`,
      `L ${W_A} ${H}`,
      `L 66 ${H}`,
      `L 44 38`,
      `L 22 ${H} Z`,
    ].join(" ");
  },
};

// Layout einer 5-Glyph-Sequenz: liefert [{glyph, x}, ...] + totalWidth
function layout(glyphs) {
  let x = 0;
  const out = [];
  for (let i = 0; i < glyphs.length; i++) {
    out.push({ glyph: glyphs[i], x });
    const w = widthOf(glyphs[i]);
    x += w + (i < glyphs.length - 1 ? G : 0);
  }
  return { items: out, totalWidth: x };
}

function widthOf(name) {
  switch (name) {
    case "I": return W_I;
    case "D": return W_D;
    case "E": return W_E;
    case "A":
    case "A_PEAK": return W_A;
    default: throw new Error("unknown glyph " + name);
  }
}

function renderWordmark(glyphSeq, opts = {}) {
  const { items, totalWidth } = layout(glyphSeq);
  const padX = 20;
  const padY = 20;
  const overlays = opts.overlays || ""; // extra SVG vor/zwischen Glyphen
  const color = opts.color || "#0A0A0A";
  const accent = opts.accent;
  const bg = opts.bg || "transparent";
  const accentSvg = opts.accentSvg ? opts.accentSvg({ items, totalWidth, padX, padY, accent }) : "";

  const glyphSvg = items
    .map(({ glyph, x }) => {
      const d = LETTER[glyph]();
      return `<path transform="translate(${x + padX} ${padY})" d="${d}" fill="${color}" fill-rule="evenodd"/>`;
    })
    .join("\n  ");

  const w = totalWidth + 2 * padX;
  const h = H + 2 * padY;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  ${bg !== "transparent" ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""}
  ${glyphSvg}
  ${accentSvg}
  ${overlays}
</svg>`;
}

// ---------- Konzepte ----------

// Konzept 1: "Brücke" — Doppel-A verbunden durch einen Brücken-Bogen oben.
function concept1Wordmark({ color = "#1B1F4B", accent = "#F4A523", bg = "transparent" } = {}) {
  // Standard-IDEA + zwei Standard-As, dazu ein Akzent-Bogen, der die beiden
  // Apex-Punkte der As verbindet (Brücken-Metapher).
  return renderWordmark(["I", "D", "E", "A", "A"], {
    color,
    accent,
    bg,
    accentSvg: ({ items, padX, padY }) => {
      const a1 = items[3];
      const a2 = items[4];
      // Beide Apex-Punkte (44, 0) bzgl. Buchstabenkoordinaten
      const x1 = padX + a1.x + 44;
      const x2 = padX + a2.x + 44;
      const y = padY + 0;
      // Bogen, der die Spitzen verbindet — 16px hoch über den Spitzen
      const ctrlY = y - 36;
      return `<path d="M ${x1} ${y} Q ${(x1 + x2) / 2} ${ctrlY} ${x2} ${y}"
        stroke="${accent}" stroke-width="14" fill="none" stroke-linecap="round"/>`;
    },
  });
}

function concept1Mark({ color = "#1B1F4B", accent = "#F4A523", bg = "transparent", size = 256 } = {}) {
  // Bildmarke: nur die Doppel-A-Brücke in einem Quadrat.
  // Inhalt füllt ~85% des Canvas damit auch 16/32px lesbar.
  const cap = Math.round(size * 0.74);
  const aw = Math.round(size * 0.36);
  const gap = Math.round(size * 0.06);
  const stroke = Math.round(size * 0.11);
  const totalW = 2 * aw + gap;
  const ox = (size - totalW) / 2;
  const oy = (size - cap) / 2 + Math.round(size * 0.08);
  // Apex-Brücke
  const apex1x = ox + aw / 2;
  const apex2x = ox + aw + gap + aw / 2;
  const apexY = oy;
  const ctrlY = apexY - Math.round(size * 0.18);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${bg !== "transparent" ? `<rect width="${size}" height="${size}" fill="${bg}" rx="${Math.round(size * 0.12)}"/>` : ""}
  <g transform="translate(${ox} ${oy})" fill="${color}" fill-rule="evenodd">
    ${aPath(aw, cap, stroke)}
    <g transform="translate(${aw + gap} 0)">${aPath(aw, cap, stroke)}</g>
  </g>
  <path d="M ${apex1x} ${apexY} Q ${(apex1x + apex2x) / 2} ${ctrlY} ${apex2x} ${apexY}"
    stroke="${accent}" stroke-width="${Math.round(size * 0.07)}" fill="none" stroke-linecap="round"/>
</svg>`;
}

function aPath(W, H, S) {
  const apexX = W / 2;
  const xbarTop = H * 0.65;
  const xbarBottom = H * 0.79;
  const apexInnerY = H * 0.27;
  const triLeftInner = (W - S) * 0.18;
  const triRightInner = W - (W - S) * 0.18;
  return `<path d="
    M 0 ${H} L ${apexX} 0 L ${W} ${H} L ${W - S} ${H}
    L ${triRightInner * 0.92} ${xbarBottom}
    L ${(S) + (W - 2 * S) * 0.08} ${xbarBottom}
    L ${S} ${H} Z
    M ${(S) + (W - 2 * S) * 0.18} ${xbarTop}
    L ${W - S - (W - 2 * S) * 0.18} ${xbarTop}
    L ${apexX} ${apexInnerY} Z
  "/>`;
}

// Konzept 2: "Rahmen" — Quadrat mit offenem Eck, Punkt tritt ein.
function concept2Wordmark({ color = "#0A0A0A", accent = "#E63946", bg = "transparent" } = {}) {
  // Bildmarke links, Standard-IDEAA rechts daneben.
  const markSize = H + 12; // ein wenig grösser als Cap-Height
  const markGap = 32;
  const padX = 20;
  const padY = 20;
  const { items, totalWidth } = layout(["I", "D", "E", "A", "A"]);
  const wordOffset = padX + markSize + markGap;
  const w = wordOffset + totalWidth + padX;
  const h = H + 2 * padY;
  const markY = padY - 6;
  const mark = concept2MarkInner({ size: markSize, color, accent, x: padX, y: markY });
  const glyphSvg = items
    .map(({ glyph, x }) => {
      const d = LETTER[glyph]();
      return `<path transform="translate(${wordOffset + x} ${padY})" d="${d}" fill="${color}" fill-rule="evenodd"/>`;
    })
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  ${bg !== "transparent" ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""}
  ${mark}
  ${glyphSvg}
</svg>`;
}

function concept2MarkInner({ size, color, accent, x = 0, y = 0 }) {
  const sw = Math.max(10, Math.round(size * 0.085));
  const half = sw / 2;
  const o = size - half;
  const gapStart = size * 0.18;
  const gapEnd = size * 0.45;
  // Rahmen mit Lücke oben links
  const frame = `<path d="
    M ${gapEnd} ${half}
    L ${o} ${half}
    L ${o} ${o}
    L ${half} ${o}
    L ${half} ${gapEnd}
  " stroke="${color}" stroke-width="${sw}" fill="none" stroke-linejoin="miter" stroke-linecap="square"/>`;
  // Punkt der durch die Lücke eintritt — sitzt halb auf der Lücke
  const dotR = Math.round(size * 0.085);
  const dotX = gapStart + dotR * 0.6;
  const dotY = gapStart + dotR * 0.6;
  const dot = `<circle cx="${dotX}" cy="${dotY}" r="${dotR}" fill="${accent}"/>`;
  return `<g transform="translate(${x} ${y})">${frame}${dot}</g>`;
}

function concept2Mark({ color = "#0A0A0A", accent = "#E63946", bg = "transparent", size = 256 } = {}) {
  const inner = concept2MarkInner({ size: size * 0.78, color, accent, x: size * 0.11, y: size * 0.11 });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${bg !== "transparent" ? `<rect width="${size}" height="${size}" fill="${bg}" rx="${Math.round(size * 0.12)}"/>` : ""}
  ${inner}
</svg>`;
}

// Konzept 3: "Peak" — Doppel-A als gerundete Bergpeaks ohne Querbalken.
function concept3Wordmark({ color = "#0F4C3A", accent = "#F6F1E7", bg = "transparent" } = {}) {
  return renderWordmark(["I", "D", "E", "A_PEAK", "A_PEAK"], { color, bg });
}

function concept3Mark({ color = "#0F4C3A", accent = "#F6F1E7", bg = "transparent", size = 256 } = {}) {
  // Zwei gerundete Peaks nebeneinander
  const cap = 150;
  const aw = 110;
  const gap = 8; // dicht zusammen → wirkt wie Doppelpeak
  const totalW = 2 * aw + gap;
  const ox = (size - totalW) / 2;
  const oy = (size - cap) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${bg !== "transparent" ? `<rect width="${size}" height="${size}" fill="${bg}" rx="${Math.round(size * 0.12)}"/>` : ""}
  <g transform="translate(${ox} ${oy})" fill="${color}">
    <path d="
      M 0 ${cap}
      L ${aw * 0.34} 30
      Q ${aw / 2} -8 ${aw * 0.66} 30
      L ${aw} ${cap}
      L ${aw * 0.78} ${cap}
      L ${aw / 2} 44
      L ${aw * 0.22} ${cap} Z
    "/>
    <g transform="translate(${aw + gap} 0)">
      <path d="
        M 0 ${cap}
        L ${aw * 0.34} 30
        Q ${aw / 2} -8 ${aw * 0.66} 30
        L ${aw} ${cap}
        L ${aw * 0.78} ${cap}
        L ${aw / 2} 44
        L ${aw * 0.22} ${cap} Z
      "/>
    </g>
  </g>
</svg>`;
}

// Konzept 4: "Sequenz" — Punkt → Linie → Quadrat (Roh → Analyse → Plan).
function concept4Wordmark({ color = "#3F1D9E", accent = "#F5C518", bg = "transparent" } = {}) {
  const markSize = H + 40;
  const markGap = 36;
  const padX = 20;
  const padY = 30;
  const { items, totalWidth } = layout(["I", "D", "E", "A", "A"]);
  const wordOffset = padX + markSize + markGap;
  const w = wordOffset + totalWidth + padX;
  const h = Math.max(H + 2 * padY, markSize + 2 * padY);
  const wordY = (h - H) / 2;
  const markY = (h - markSize) / 2;
  const mark = concept4MarkInner({ size: markSize, color, accent, x: padX, y: markY });
  const glyphSvg = items
    .map(({ glyph, x }) => {
      const d = LETTER[glyph]();
      return `<path transform="translate(${wordOffset + x} ${wordY})" d="${d}" fill="${color}" fill-rule="evenodd"/>`;
    })
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  ${bg !== "transparent" ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""}
  ${mark}
  ${glyphSvg}
</svg>`;
}

function concept4MarkInner({ size, color, accent, x = 0, y = 0 }) {
  // 3 horizontale Glyphen vertikal zentriert: Punkt, Linie, Quadrat.
  const cy = size / 2;
  const dotR = size * 0.07;
  const lineW = size * 0.16;
  const lineH = size * 0.08;
  const sqSize = size * 0.32;
  const sqStroke = Math.max(8, Math.round(size * 0.07));
  // Anordnen mit gleichen Lücken
  const totalW = dotR * 2 + size * 0.12 + lineW + size * 0.12 + sqSize;
  const startX = (size - totalW) / 2;
  let cx = startX;
  // Dot
  const dotX = cx + dotR;
  cx += dotR * 2 + size * 0.12;
  // Line
  const lineX = cx;
  cx += lineW + size * 0.12;
  // Square (outlined)
  const sqX = cx;
  const sqY = cy - sqSize / 2;
  return `<g transform="translate(${x} ${y})">
    <circle cx="${dotX}" cy="${cy}" r="${dotR}" fill="${accent}"/>
    <rect x="${lineX}" y="${cy - lineH / 2}" width="${lineW}" height="${lineH}" fill="${color}"/>
    <rect x="${sqX + sqStroke / 2}" y="${sqY + sqStroke / 2}" width="${sqSize - sqStroke}" height="${sqSize - sqStroke}" fill="none" stroke="${color}" stroke-width="${sqStroke}"/>
  </g>`;
}

function concept4Mark({ color = "#3F1D9E", accent = "#F5C518", bg = "transparent", size = 256 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${bg !== "transparent" ? `<rect width="${size}" height="${size}" fill="${bg}" rx="${Math.round(size * 0.12)}"/>` : ""}
  ${concept4MarkInner({ size: size * 0.86, color, accent, x: size * 0.07, y: size * 0.07 })}
</svg>`;
}

// ---------- OG-Card (1200x630) ----------
function buildOgCard({ wordmarkSvg, bg, fg, accent, tagline }) {
  // OG-Card mit grossem Wortmarken-Element zentriert und einem Tagline-Text drunter.
  // Tagline ist ebenfalls geometrisch konstruiert (kleine Pillen) statt Text,
  // damit kein Font benötigt wird. Stattdessen ein Akzent-Streifen.
  const w = 1200;
  const h = 630;
  // Strip Outer SVG tags from wordmark, get inner content + viewBox
  const vbMatch = wordmarkSvg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const innerMatch = wordmarkSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (!vbMatch || !innerMatch) throw new Error("invalid wordmark svg");
  const [, vbw, vbh] = vbMatch;
  const inner = innerMatch[1];
  const targetW = w * 0.66;
  const scale = targetW / parseFloat(vbw);
  const scaledH = parseFloat(vbh) * scale;
  const offsetX = (w - targetW) / 2;
  const offsetY = (h - scaledH) / 2 - 20;
  // Akzent-Streifen unten
  const stripY = h - 80;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <g transform="translate(${offsetX} ${offsetY}) scale(${scale})">${inner}</g>
  <rect x="0" y="${stripY}" width="${w}" height="6" fill="${accent}"/>
</svg>`;
}

// ---------- Render-Pipeline ----------

const CONCEPTS = [
  {
    id: 1,
    slug: "bruecke",
    name: "Brücke",
    color: "#1B1F4B",
    accent: "#F4A523",
    bg: "#F7F4EC",
    monoColor: "#0A0A0A",
    wordmark: (opts) => concept1Wordmark(opts),
    mark: (opts) => concept1Mark(opts),
  },
  {
    id: 2,
    slug: "rahmen",
    name: "Rahmen",
    color: "#0A0A0A",
    accent: "#E63946",
    bg: "#FFFFFF",
    monoColor: "#0A0A0A",
    wordmark: (opts) => concept2Wordmark(opts),
    mark: (opts) => concept2Mark(opts),
  },
  {
    id: 3,
    slug: "peak",
    name: "Peak",
    color: "#0F4C3A",
    accent: "#D97032",
    bg: "#F6F1E7",
    monoColor: "#0A0A0A",
    wordmark: (opts) => concept3Wordmark(opts),
    mark: (opts) => concept3Mark(opts),
  },
  {
    id: 4,
    slug: "sequenz",
    name: "Sequenz",
    color: "#3F1D9E",
    accent: "#F5C518",
    bg: "#FAFAFF",
    monoColor: "#0A0A0A",
    wordmark: (opts) => concept4Wordmark(opts),
    mark: (opts) => concept4Mark(opts),
  },
];

async function ensureDirs() {
  await fs.mkdir(SVG_DIR, { recursive: true });
  await fs.mkdir(PNG_DIR, { recursive: true });
}

async function writeSvgs() {
  for (const c of CONCEPTS) {
    const base = `concept-${c.id}-${c.slug}`;
    await fs.writeFile(path.join(SVG_DIR, `${base}-wordmark.svg`),
      c.wordmark({ color: c.color, accent: c.accent }));
    await fs.writeFile(path.join(SVG_DIR, `${base}-wordmark-mono.svg`),
      c.wordmark({ color: c.monoColor, accent: c.monoColor }));
    await fs.writeFile(path.join(SVG_DIR, `${base}-mark.svg`),
      c.mark({ color: c.color, accent: c.accent, size: 256 }));
    await fs.writeFile(path.join(SVG_DIR, `${base}-mark-mono.svg`),
      c.mark({ color: c.monoColor, accent: c.monoColor, size: 256 }));
  }
}

async function renderPngs() {
  for (const c of CONCEPTS) {
    const base = `concept-${c.id}-${c.slug}`;
    // Bildmarke in 16/32/256, mit weichem Hintergrund je Konzept
    for (const size of [16, 32, 256]) {
      const svg = c.mark({ color: c.color, accent: c.accent, bg: c.bg, size });
      await sharp(Buffer.from(svg))
        .png()
        .resize(size, size)
        .toFile(path.join(PNG_DIR, `${base}-mark-${size}.png`));
    }
    // Mono 256
    const monoSvg = c.mark({ color: c.monoColor, accent: c.monoColor, bg: "#FFFFFF", size: 256 });
    await sharp(Buffer.from(monoSvg))
      .png()
      .resize(256, 256)
      .toFile(path.join(PNG_DIR, `${base}-mark-mono-256.png`));
    // OG-Card 1200x630
    const wm = c.wordmark({ color: c.color, accent: c.accent });
    const og = buildOgCard({
      wordmarkSvg: wm,
      bg: c.bg,
      fg: c.color,
      accent: c.accent,
      tagline: "Idee → Validierung → Plan",
    });
    await sharp(Buffer.from(og))
      .png()
      .toFile(path.join(PNG_DIR, `${base}-og-1200x630.png`));
    // Zusätzlich: Wortmarke als 1200xN für Preview
    const wmBuf = Buffer.from(wm);
    await sharp(wmBuf)
      .png()
      .resize({ width: 1200 })
      .toFile(path.join(PNG_DIR, `${base}-wordmark-1200.png`));
  }
}

async function main() {
  await ensureDirs();
  await writeSvgs();
  await renderPngs();
  console.log("OK");
}

main().catch((e) => { console.error(e); process.exit(1); });
