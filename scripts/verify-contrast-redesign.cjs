/* Final evidence probe: WebGL renderer string (GPU vs SwiftShader) to explain
   headless FPS, accent-usage restraint on home, WCAG contrast ratios for the
   token pairs, button hover/focus behavior, animation liveness. */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:3000";

function luminance(r, g, b) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const l1 = luminance(...a), l2 = luminance(...b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return ((hi + 0.05) / (lo + 0.05)).toFixed(2);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/lab?device=microscope", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(3000);

  // GPU vs software renderer explains headless FPS
  const glInfo = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const gl = c && (c.getContext("webgl2") || c.getContext("webgl"));
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    };
  });

  // Accent restraint on home
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const accentUsage = await page.evaluate(() => {
    const accent = "rgb(183, 255, 74)";
    let accentEls = 0, total = 0;
    for (const el of document.querySelectorAll("main *, footer *")) {
      if (el.children.length === 0 && (el.textContent || "").trim()) {
        total++;
        if (getComputedStyle(el).color === accent) accentEls++;
      }
    }
    return { accentTextElements: accentEls, totalTextElements: total, pct: ((accentEls / total) * 100).toFixed(1) + "%" };
  });

  // Button states
  const buttonStates = await page.evaluate(() => {
    const btn = document.querySelector(".button");
    if (!btn) return null;
    const base = getComputedStyle(btn).backgroundColor;
    return { baseBg: base };
  });
  const cta = page.locator(".button").first();
  await cta.hover();
  await page.waitForTimeout(400);
  const hoverState = await page.evaluate(() => {
    const btn = document.querySelector(".button");
    const s = getComputedStyle(btn);
    return { hoverBg: s.backgroundColor, hoverShadow: s.boxShadow.slice(0, 80), hoverTranslate: s.translate };
  });

  // Animation liveness: marquee transform changes over time
  const marqueeAnim = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const el = document.querySelector(".research-marquee > div");
        if (!el) return resolve("no-marquee");
        const t1 = getComputedStyle(el).transform;
        setTimeout(() => {
          const t2 = getComputedStyle(el).transform;
          resolve(t1 !== t2 ? "animating" : "static");
        }, 600);
      }),
  );

  const contrastRatios = {
    "ink on page": contrast([242, 242, 239], [7, 8, 9]),
    "muted on page": contrast([184, 188, 191], [7, 8, 9]),
    "faint on page": contrast([115, 121, 125], [7, 8, 9]),
    "accent on page": contrast([183, 255, 74], [7, 8, 9]),
    "on-accent on accent": contrast([12, 18, 6], [183, 255, 74]),
    "ink on surface": contrast([242, 242, 239], [12, 14, 16]),
    "muted on surface": contrast([184, 188, 191], [12, 14, 16]),
  };

  fs.writeFileSync(
    "verify/redesign/contrast-results.json",
    JSON.stringify({ glInfo, accentUsage, buttonStates, hoverState, marqueeAnim, contrastRatios }, null, 2),
  );
  console.log(JSON.stringify({ glInfo, accentUsage, buttonStates, hoverState, marqueeAnim, contrastRatios }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
