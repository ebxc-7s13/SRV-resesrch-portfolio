/* Focused probe: 1) full hydration warning text + source, 2) lab 3D render
   verification (canvas, WebGL, console errors, FPS smoke), 3) accent color
   samples on real elements. */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const allMsgs = [];
  page.on("console", (m) => {
    allMsgs.push({ url: page.url(), type: m.type(), text: m.text().slice(0, 600) });
  });
  page.on("pageerror", (e) =>
    allMsgs.push({ url: page.url(), type: "pageerror", text: String(e).slice(0, 600) }),
  );

  // ---- 1. Hydration warning on home: capture full text ----
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  // ---- 2. Accent sampling on real elements (home) ----
  const accentSamples = await page.evaluate(() => {
    const grab = (sel, prop) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : null;
    };
    const check = (sel, prop, expected) => {
      const got = grab(sel, prop);
      return { sel, expected, got, ok: got === expected };
    };
    const accent = "rgb(183, 255, 74)";
    const faint = "rgb(115, 121, 125)";
    const muted = "rgb(184, 188, 191)";
    const ink = "rgb(242, 242, 239)";
    return [
      check(".hero-domains", "color", accent),
      check(".eyebrow", "color", muted),
      check(".page-title span", "color", accent),
      check(".hero-description", "color", muted),
      check(".depth-card", "border-top-color", "rgb(32, 33, 34)"),
      check(".site-navigation", "background-color", null),
    ];
  });

  // ---- 3. Lab: verify 3D loads, WebGL context, FPS smoke ----
  await page.goto(BASE + "/lab", { waitUntil: "networkidle", timeout: 60000 });
  // lab 3D is lazy; give the dynamic import time
  await page.waitForTimeout(6000);

  const labState1 = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")];
    return canvases.map((c) => {
      let gl = null;
      try {
        gl = c.getContext("webgl2") || c.getContext("webgl");
      } catch {}
      return {
        w: c.width, h: c.height,
        visible: c.offsetParent !== null,
        webgl: !!gl,
      };
    });
  });

  // FPS smoke: measure rAF cadence for ~1.5s
  const fps = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        function tick() {
          frames++;
          if (performance.now() - start < 1500) requestAnimationFrame(tick);
          else resolve(Math.round((frames / (performance.now() - start)) * 1000));
        }
        requestAnimationFrame(tick);
      }),
  );

  // interact: click a station/panel if present, then re-check
  const labButtons = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button, a")];
    return btns
      .filter((b) => /device|station|microscope|inspect/i.test(b.textContent || ""))
      .slice(0, 5)
      .map((b) => (b.textContent || "").trim().slice(0, 40));
  });

  await page.screenshot({ path: "verify/redesign/lab-3d.png" });
  fs.writeFileSync(
    "verify/redesign/deep-results.json",
    JSON.stringify({ accentSamples, labState1, fps, labButtons, consoleMsgs: allMsgs.slice(0, 40) }, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        accentSamples,
        labState1,
        fps,
        labButtons,
        hydrationCount: allMsgs.filter((m) => /hydrat/i.test(m.text)).length,
        hydrationFull: allMsgs.find((m) => /hydrat/i.test(m.text))?.text || null,
      },
      null,
      2,
    ),
  );
  await browser.close();
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
