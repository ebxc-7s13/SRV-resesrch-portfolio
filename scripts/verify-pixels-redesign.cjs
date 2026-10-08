/* Pixel-level sanity check of captured screenshots: decode each PNG in a
   browser canvas and sample pixels to confirm dark editorial backgrounds and
   non-blank renders. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = "verify/redesign";

(async () => {
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".png"));
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const report = [];
  for (const file of files) {
    const buf = fs.readFileSync(path.join(OUT, file)).toString("base64");
    const stats = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const c = document.createElement("canvas");
      const scale = Math.min(1, 400 / img.width);
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const corners = [
        [3, 3], [c.width - 4, 3], [3, c.height - 4], [c.width - 4, c.height - 4],
        [Math.floor(c.width / 2), Math.floor(c.height * 0.75)],
      ];
      const px = corners.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3));
      const avg = px.reduce((s, p) => s + (p[0] + p[1] + p[2]) / 3, 0) / px.length;
      // variance across samples proves the render isn't blank
      const all = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, sum2 = 0, n = 0;
      for (let i = 0; i < all.length; i += 397 * 4) { const v = (all[i] + all[i + 1] + all[i + 2]) / 3; sum += v; sum2 += v * v; n++; }
      const mean = sum / n;
      return { corners: px, avgCornerLuma: Math.round(avg), stdDev: Math.round(Math.sqrt(sum2 / n - mean * mean) * 10) / 10, w: img.width, h: img.height };
    }, buf);
    report.push({ file, ...stats });
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "pixel-check.json"), JSON.stringify(report, null, 2));
  for (const r of report)
    console.log(
      `${r.file.padEnd(34)} ${r.w}x${r.h}  avgCorner=${r.avgCornerLuma}  stdDev=${r.stdDev}`,
    );
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
