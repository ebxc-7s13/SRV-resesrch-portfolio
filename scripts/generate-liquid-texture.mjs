#!/usr/bin/env node
/**
 * Generate public/liquid.webp — the texture the liquid1 background refracts.
 *
 * The liquid shader bends mid-frequency detail, so the texture is engineered
 * with: a dark night base, two accent glows (signal lime / cyan), concentric
 * interference rings (structure for displacement to bend) and fine grain.
 * Mean luminance is kept low — the canvas sits behind all page text.
 *
 * Usage (all flags optional, defaults produce the shipped look):
 *   node scripts/generate-liquid-texture.mjs
 *
 * Flags:
 *   --out <path>          output file (default public/liquid.webp)
 *   --size <px>           texture size, square (default 1024)
 *   --quality <n>         webp quality (default 92)
 *   --base <hex>          base color (default #0c0e10)
 *   --vignette <hex>      corner color (default #070809)
 *   --lime <hex>          signal-lime glow color (default #b7ff4a)
 *   --cyan <hex>          cyan glow color (default #7de7ff)
 *   --lime-alpha <n>      lime glow peak opacity (default 0.16)
 *   --cyan-alpha <n>      cyan glow peak opacity (default 0.12)
 *   --rings-alpha <n>     interference ring opacity (default 0.07)
 *   --grain <n>           grain opacity (default 0.025)
 *   --rings-on / --rings-off    include interference rings (default on)
 *   --dry-run             print settings without writing
 *
 * Examples:
 *   node scripts/generate-liquid-texture.mjs --lime-alpha 0.22 --rings-alpha 0.08
 *   node scripts/generate-liquid-texture.mjs --out /tmp/liquid-try.webp --dry-run
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (flag) => process.argv.includes(flag);

const opts = {
  out: argValue("--out") ?? "public/liquid.webp",
  size: Number(argValue("--size") ?? 1024),
  quality: Number(argValue("--quality") ?? 92),
  base: argValue("--base") ?? "#0c0e10",
  vignette: argValue("--vignette") ?? "#070809",
  lime: argValue("--lime") ?? "#b7ff4a",
  cyan: argValue("--cyan") ?? "#7de7ff",
  limeAlpha: Number(argValue("--lime-alpha") ?? 0.16),
  cyanAlpha: Number(argValue("--cyan-alpha") ?? 0.12),
  ringsAlpha: Number(argValue("--rings-alpha") ?? 0.07),
  grain: Number(argValue("--grain") ?? 0.025),
  rings: has("--rings-off") ? false : true,
  dryRun: has("--dry-run"),
};

const S = opts.size;
const hex = (h) => {
  const n = h.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};
const [br, bg, bb] = hex(opts.base);
const [vr, vg, vb] = hex(opts.vignette);
const [lr, lg, lb] = hex(opts.lime);
const [cr, cg, cb] = hex(opts.cyan);
const grainCount = Math.round(9000 * (opts.grain / 0.025));

// Sharp renders SVG <filter> feTurbulence unreliably across builds, so grain
// is composited as a raw RGBA buffer: semi-transparent noise pixels drawn
// over the SVG glows.
const grainBuf = Buffer.alloc(S * S * 4);
for (let i = 0; i < grainCount; i++) {
  const x = Math.floor(Math.random() * S);
  const y = Math.floor(Math.random() * S);
  const o = (y * S + x) * 4;
  const v = 255;
  const a = Math.round(255 * (opts.grain * (0.5 + Math.random() * 0.5)));
  grainBuf[o] = v;
  grainBuf[o + 1] = v;
  grainBuf[o + 2] = v;
  grainBuf[o + 3] = a;
}

const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${S}' height='${S}'>
  <defs>
    <radialGradient id='base' cx='50%' cy='30%' r='95%'>
      <stop offset='0%' stop-color='${opts.base}'/>
      <stop offset='58%' stop-color='${opts.base}'/>
      <stop offset='100%' stop-color='${opts.vignette}'/>
    </radialGradient>
    <radialGradient id='lime' cx='76%' cy='16%' r='58%'>
      <stop offset='0%' stop-color='rgb(${lr},${lg},${lb})' stop-opacity='${opts.limeAlpha}'/>
      <stop offset='42%' stop-color='rgb(${lr},${lg},${lb})' stop-opacity='${(opts.limeAlpha * 0.35).toFixed(3)}'/>
      <stop offset='100%' stop-color='rgb(${lr},${lg},${lb})' stop-opacity='0'/>
    </radialGradient>
    <radialGradient id='cyan' cx='16%' cy='78%' r='54%'>
      <stop offset='0%' stop-color='rgb(${cr},${cg},${cb})' stop-opacity='${opts.cyanAlpha}'/>
      <stop offset='42%' stop-color='rgb(${cr},${cg},${cb})' stop-opacity='${(opts.cyanAlpha * 0.35).toFixed(3)}'/>
      <stop offset='100%' stop-color='rgb(${cr},${cg},${cb})' stop-opacity='0'/>
    </radialGradient>
    <mask id='fadeLime'>
      <radialGradient id='maskLime' cx='76%' cy='16%' r='46%'>
        <stop offset='0%' stop-color='white'/>
        <stop offset='55%' stop-color='rgb(140,140,140)'/>
        <stop offset='100%' stop-color='black'/>
      </radialGradient>
      <rect width='${S}' height='${S}' fill='url(#maskLime)'/>
    </mask>
    <mask id='fadeCyan'>
      <radialGradient id='maskCyan' cx='16%' cy='78%' r='44%'>
        <stop offset='0%' stop-color='white'/>
        <stop offset='55%' stop-color='rgb(140,140,140)'/>
        <stop offset='100%' stop-color='black'/>
      </radialGradient>
      <rect width='${S}' height='${S}' fill='url(#maskCyan)'/>
    </mask>
  </defs>
  <rect width='${S}' height='${S}' fill='url(#base)'/>
  <rect width='${S}' height='${S}' fill='url(#lime)'/>
  <rect width='${S}' height='${S}' fill='url(#cyan)'/>
  ${
    opts.rings
      ? `<g opacity='${opts.ringsAlpha}' mask='url(#fadeLime)'>
    ${Array.from({ length: 22 }, (_, i) => {
      const r = 60 + i * 42 + (i % 3) * 12;
      return `<circle cx='${(S * 0.76).toFixed(0)}' cy='${(S * 0.16).toFixed(0)}' r='${r}' fill='none' stroke='rgb(183,255,74)' stroke-width='${i % 4 === 0 ? 3 : 1.4}'/>`;
    }).join("\n    ")}
  </g>
  <g opacity='${opts.ringsAlpha}' mask='url(#fadeCyan)'>
    ${Array.from({ length: 16 }, (_, i) => {
      const r = 52 + i * 46 + (i % 3) * 14;
      return `<circle cx='${(S * 0.16).toFixed(0)}' cy='${(S * 0.78).toFixed(0)}' r='${r}' fill='none' stroke='rgb(125,231,255)' stroke-width='${i % 4 === 0 ? 3 : 1.4}'/>`;
    }).join("\n    ")}
  </g>`
      : ""
  }
</svg>`;

if (opts.dryRun) {
  console.log("settings:", JSON.stringify(opts, null, 2));
  process.exit(0);
}

const grainImg = sharp(grainBuf, {
  raw: { width: S, height: S, channels: 4 },
});
void grainImg; // raw buffer composited below via { input, raw }
await sharp(Buffer.from(svg))
  .composite([
    {
      input: grainBuf,
      raw: { width: S, height: S, channels: 4 },
      blend: "over",
    },
  ])
  .webp({ quality: opts.quality })
  .toFile(opts.out);

const info = await sharp(opts.out).metadata();
const { data } = await sharp(opts.out)
  .raw()
  .toBuffer({ resolveWithObject: true });
let sum = 0;
let maxL = 0;
const n = data.length;
const step = 16; // sample every 4th pixel (RGBA)
for (let i = 0; i < n; i += step) sum += data[i];
const sampled = Math.floor(n / step);
const meanLum = sum / sampled / 255;
console.log(
  `wrote ${opts.out}  ${info.width}x${info.height}  ${(await fs.stat(opts.out)).size} bytes  mean-luminance ${meanLum.toFixed(3)} (target < 0.10)`,
);
if (meanLum > 0.1)
  console.warn("WARNING: texture brighter than target — text legibility risk");
