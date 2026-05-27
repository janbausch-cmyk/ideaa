// IDEAA Peak-Logo Rollout
// Generiert alle Produkt-Assets aus den Peak-SVGs:
// - src/app/favicon.ico (Multi 16/32/48)
// - src/app/icon.svg  (Mark als currentColor SVG)
// - src/app/apple-icon.png (180x180)
// - src/app/opengraph-image.png (1200x630, kopiert von branding/png)
// - src/app/opengraph-image.alt.txt
// - src/app/twitter-image.png (gleiche Datei)
// - src/app/twitter-image.alt.txt
// - public/peak-wordmark-color.svg (#0F4C3A) + mono.svg (white)
// - public/peak-wordmark-1200.png (für README hero)
// - public/peak-mark.svg (currentColor) – falls Inline-Komponenten Datei laden wollen
// - branding/telegram-avatar.png (256x256, IDEAA-Bildmarke)
//
// Aufruf:  node branding/logos/rollout-assets.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const SVG_DIR = path.join(__dirname, "svg");
const PNG_DIR = path.join(__dirname, "png");
const APP_DIR = path.join(ROOT, "src", "app");
const PUBLIC_DIR = path.join(ROOT, "public");
const BRAND_DIR = path.join(ROOT, "branding");

const PEAK_GREEN = "#0F4C3A";
const PEAK_MONO_LIGHT = "#0A0A0A";
const PEAK_MONO_DARK = "#F5F5F4";

async function readSvg(name) {
  return fs.readFile(path.join(SVG_DIR, name), "utf8");
}

async function writeFile(p, data) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
  console.log("wrote", path.relative(ROOT, p));
}

// Ersetzt feste Hex-Fills durch currentColor.
function toCurrentColor(svg) {
  return svg.replace(/fill="#[0-9A-Fa-f]{3,6}"/g, 'fill="currentColor"');
}

// Tauscht Fill-Farbe (alle Hex-Fills) gegen color.
function recolor(svg, color) {
  return svg.replace(/fill="#[0-9A-Fa-f]{3,6}"/g, `fill="${color}"`);
}

// Schreibt eine Multi-Size ICO aus PNG-Buffern (PNG-in-ICO Format).
async function writeIco(outPath, pngBuffers) {
  // ICONDIR: reserved(2)=0, type(2)=1, count(2)
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  const datas = [];
  let offset = 6 + 16 * count;
  for (const { size, buf } of pngBuffers) {
    const entry = Buffer.alloc(16);
    // width/height: 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // colorCount
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    datas.push(buf);
    offset += buf.length;
  }
  const all = Buffer.concat([header, ...entries, ...datas]);
  await writeFile(outPath, all);
}

async function main() {
  const markSvgRaw = await readSvg("concept-3-peak-mark.svg");
  const wordmarkSvgRaw = await readSvg("concept-3-peak-wordmark.svg");
  const wordmarkMonoSvgRaw = await readSvg("concept-3-peak-wordmark-mono.svg");

  // ---- public/ : Wordmark-Varianten für Header und README ----
  await writeFile(
    path.join(PUBLIC_DIR, "peak-wordmark-color.svg"),
    recolor(wordmarkSvgRaw, PEAK_GREEN),
  );
  await writeFile(
    path.join(PUBLIC_DIR, "peak-wordmark-mono-dark.svg"),
    recolor(wordmarkMonoSvgRaw, PEAK_MONO_LIGHT),
  );
  await writeFile(
    path.join(PUBLIC_DIR, "peak-wordmark-mono-light.svg"),
    recolor(wordmarkMonoSvgRaw, PEAK_MONO_DARK),
  );
  await writeFile(
    path.join(PUBLIC_DIR, "peak-wordmark.svg"),
    toCurrentColor(wordmarkSvgRaw),
  );
  await writeFile(
    path.join(PUBLIC_DIR, "peak-mark.svg"),
    toCurrentColor(markSvgRaw),
  );

  // PNG Wordmark 1200 (existiert bereits unter branding/png), zusätzlich nach public/ für README/Repo
  const wordmark1200 = await fs.readFile(
    path.join(PNG_DIR, "concept-3-peak-wordmark-1200.png"),
  );
  await writeFile(
    path.join(PUBLIC_DIR, "peak-wordmark-1200.png"),
    wordmark1200,
  );
  // Dark-Mode-Version: weisses Peak-Wordmark auf transparentem BG, 1200 breit
  const wordmarkSvgWhite = recolor(wordmarkMonoSvgRaw, PEAK_MONO_DARK);
  const wordmark1200White = await sharp(Buffer.from(wordmarkSvgWhite))
    .resize({ width: 1200 })
    .png()
    .toBuffer();
  await writeFile(
    path.join(PUBLIC_DIR, "peak-wordmark-1200-dark.png"),
    wordmark1200White,
  );

  // ---- src/app/ : Next.js File-Convention Assets ----
  // icon.svg (Bildmarke, dunkelgrün – Browser-Tab-Hintergrund ist meist hell/dunkel je nach Theme;
  // wir nehmen die Farb-Variante als Default; dunkle Browser zeigen sie auf dunklem BG noch lesbar.)
  await writeFile(
    path.join(APP_DIR, "icon.svg"),
    recolor(markSvgRaw, PEAK_GREEN),
  );

  // apple-icon.png 180x180 mit weissem Hintergrund (Apple maskiert keine SVG; weißes Padding garantiert Lesbarkeit auf iOS).
  const appleIconBuf = await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(Buffer.from(recolor(markSvgRaw, PEAK_GREEN)))
          .resize({ width: 132, height: 132 })
          .png()
          .toBuffer(),
        gravity: "center",
      },
    ])
    .png()
    .toBuffer();
  await writeFile(path.join(APP_DIR, "apple-icon.png"), appleIconBuf);

  // favicon.ico – Multi-Size 16/32/48 PNG-in-ICO
  async function markPng(size, bg) {
    const inner = Math.round(size * 0.78);
    const base = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: bg || { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });
    return base
      .composite([
        {
          input: await sharp(Buffer.from(recolor(markSvgRaw, PEAK_GREEN)))
            .resize({ width: inner, height: inner })
            .png()
            .toBuffer(),
          gravity: "center",
        },
      ])
      .png()
      .toBuffer();
  }
  const ico16 = await markPng(16);
  const ico32 = await markPng(32);
  const ico48 = await markPng(48);
  await writeIco(path.join(APP_DIR, "favicon.ico"), [
    { size: 16, buf: ico16 },
    { size: 32, buf: ico32 },
    { size: 48, buf: ico48 },
  ]);

  // opengraph-image.png + twitter-image.png (gleiche Datei, 1200x630)
  const ogSrc = await fs.readFile(
    path.join(PNG_DIR, "concept-3-peak-og-1200x630.png"),
  );
  await writeFile(path.join(APP_DIR, "opengraph-image.png"), ogSrc);
  await writeFile(
    path.join(APP_DIR, "opengraph-image.alt.txt"),
    "IDEAA – paste an idea, get a validation report",
  );
  await writeFile(path.join(APP_DIR, "twitter-image.png"), ogSrc);
  await writeFile(
    path.join(APP_DIR, "twitter-image.alt.txt"),
    "IDEAA – paste an idea, get a validation report",
  );

  // ---- branding/telegram-avatar.png (256x256, weisser BG für Avatar-Kreis) ----
  const tgBuf = await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(Buffer.from(recolor(markSvgRaw, PEAK_GREEN)))
          .resize({ width: 190, height: 190 })
          .png()
          .toBuffer(),
        gravity: "center",
      },
    ])
    .png()
    .toBuffer();
  await writeFile(path.join(BRAND_DIR, "telegram-avatar.png"), tgBuf);

  console.log("\nRollout-Assets erfolgreich generiert.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
