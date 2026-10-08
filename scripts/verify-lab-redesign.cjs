/* Lab 3D probe: enter the microscope inspection deep link, wait for the R3F
   canvas, verify WebGL context, capture console errors, FPS, screenshot.
   Also screenshots the home #lab exhibit. */
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:3000";

async function probeLab(page, url, shot) {
  const errs = [];
  const onConsole = (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 200));
  };
  page.on("console", onConsole);

  await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 60000 });
  // R3F scene is lazy: wait up to 20s for a WebGL canvas
  let canvasFound = false;
  try {
    await page.waitForSelector("canvas", { timeout: 20000 });
    canvasFound = true;
  } catch {}
  await page.waitForTimeout(4000);

  const state = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")];
    const info = canvases.map((c) => {
      let webgl = false;
      try {
        webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
      } catch {}
      return { w: c.width, h: c.height, visible: c.offsetParent !== null, webgl };
    });
    return {
      canvasInfo: info,
      docHeight: document.documentElement.scrollHeight,
      buttons: [...document.querySelectorAll("button")]
        .map((b) => (b.textContent || "").trim().slice(0, 30))
        .filter(Boolean)
        .slice(0, 12),
    };
  });

  // FPS smoke while the scene runs
  let fps = null;
  if (canvasFound) {
    fps = await page.evaluate(
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
  }

  await page.screenshot({ path: shot });
  page.off("console", onConsole);
  return { url, canvasFound, ...state, fps, errors: errs.slice(0, 8) };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const results = {};
  results.labInspection = await probeLab(page, "/lab?device=microscope", "verify/redesign/lab-inspection.png");
  results.homeLab = await probeLab(page, "/#lab", "verify/redesign/home-lab-exhibit.png");

  fs.writeFileSync("verify/redesign/lab-results.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
