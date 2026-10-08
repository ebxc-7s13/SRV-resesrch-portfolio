/* Phase 24 browser verification: renders pages in real Chromium, checks for
   console errors, horizontal overflow, and captures theme screenshots. */
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const routes = [
  "/",
  "/research",
  "/publications",
  "/patents",
  "/thesis",
  "/timeline",
  "/about",
  "/contact",
];
const themes = ["night", "day", "blossom"];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${page.url()} :: ${m.text().slice(0, 160)}`);
  });
  page.on("pageerror", (e) => errors.push(`${page.url()} :: PAGEERROR ${String(e).slice(0, 160)}`));

  for (const route of routes) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log(`${route} :: overflowX=${overflow}px`);
  }

  // Theme sweep on home + timeline, capture screenshots.
  for (const theme of themes) {
    for (const route of ["/", "/timeline"]) {
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t;
        try { localStorage.setItem("theme", t); } catch {}
      }, theme);
      await page.waitForTimeout(1200);
      const name = `${route === "/" ? "home" : "timeline"}-${theme}.png`;
      await page.screenshot({ path: `verify/${name}`, fullPage: false });
      console.log(`shot: ${name}`);
    }
  }

  // Magnetic CTA: hover the hero primary CTA and read its transform var.
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const cta = page.locator("a[data-magnet]").first();
  if (await cta.count()) {
    const box = await cta.boundingBox();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.9, { steps: 8 });
    await page.waitForTimeout(400);
    const pulled = await cta.evaluate((el) => getComputedStyle(el).transform);
    console.log("magnet transform while hovering:", pulled);
  }

  // SplitText reveal: after animation the h1 DOM should be restored.
  await page.waitForTimeout(2500);
  const heroOk = await page.evaluate(() => {
    const el = document.querySelector(".hero-identity h1");
    return el ? el.textContent.includes("SILUVERU") : false;
  });
  console.log("hero text intact after reveal:", heroOk);

  // Mobile viewport: no overflow, no magnet transform.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const mOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log("mobile overflowX:", mOverflow, "px");
  await page.screenshot({ path: "verify/home-mobile.png" });

  console.log("console errors:", errors.length ? errors.slice(0, 10) : "none");
  await browser.close();
})();
