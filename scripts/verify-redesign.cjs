/* Rendered-browser validation of the design transformation.
   Resolves playwright from the npx cache (repo has no local playwright dep).
   Checks: routes render, token colors applied, Space Grotesk loaded,
   mono labels, overflow, console/page errors, failed requests,
   WebGL/canvas presence, and captures screenshots. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "verify/redesign";
fs.mkdirSync(OUT, { recursive: true });

const results = { routes: [], errors: [], failedRequests: [], shots: [] };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  page.on("console", (m) => {
    if (m.type() === "error")
      results.errors.push(`${page.url()} :: ${m.text().slice(0, 220)}`);
  });
  page.on("pageerror", (e) =>
    results.errors.push(`${page.url()} :: PAGEERROR ${String(e).slice(0, 220)}`),
  );
  page.on("requestfailed", (r) =>
    results.failedRequests.push(`${r.method()} ${r.url().slice(0, 160)} :: ${r.failure()?.errorText}`),
  );
  page.on("response", (r) => {
    if (r.status() >= 400) results.failedRequests.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`);
    if (/\.(woff2?|png|jpg|jpeg|webp|glb|gltf|mp4)(\?|$)/i.test(r.url()) && r.status() >= 400)
      results.failedRequests.push(`ASSET ${r.status()} ${r.url().slice(0, 160)}`);
  });

  const routes = [
    "/", "/about", "/research", "/publications", "/patents",
    "/thesis", "/timeline", "/contact", "/blog", "/search",
    "/admin", "/admin/projects", "/admin/publications", "/admin/themes", "/admin/site-content",
    "/lab", "/lab/models",
  ];

  for (const route of routes) {
    const entry = { route, status: 0, overflow: 0, title: "" };
    try {
      const resp = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
      entry.status = resp.status();
      await page.waitForTimeout(900);
      const audit = await page.evaluate(() => {
        const cs = getComputedStyle(document.body);
        const rootStyle = getComputedStyle(document.documentElement);
        const h1 = document.querySelector("h1");
        const h1Style = h1 ? getComputedStyle(h1) : null;
        const monoLabel = document.querySelector(".font-mono, .hero-domains, .eyebrow, .nav-item, code");
        // effective page background: walk up from body's first rendered child
        const sample = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          let node = el;
          while (node && node !== document.documentElement) {
            const bg = getComputedStyle(node).backgroundColor;
            if (bg && !bg.includes("0, 0, 0, 0") && bg !== "transparent") return bg;
            node = node.parentElement;
          }
          return null;
        };
        const canvas = document.querySelector("canvas");
        return {
          theme: document.documentElement.dataset.theme,
          bodyBg: cs.backgroundColor,
          bodyColor: cs.color,
          pageVar: rootStyle.getPropertyValue("--page").trim(),
          accentVar: rootStyle.getPropertyValue("--accent").trim(),
          faintVar: rootStyle.getPropertyValue("--faint").trim(),
          h1Font: h1Style ? h1Style.fontFamily.slice(0, 60) : null,
          h1Size: h1Style ? h1Style.fontSize : null,
          bodyFont: cs.fontFamily.slice(0, 60),
          monoFont: monoLabel ? getComputedStyle(monoLabel).fontFamily.slice(0, 60) : null,
          canvasCount: document.querySelectorAll("canvas").length,
          bgCanvas: canvas ? { w: canvas.width, h: canvas.height } : null,
          docHeight: document.documentElement.scrollHeight,
        };
      });
      entry.overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      Object.assign(entry, audit);
      entry.title = await page.title();
      // screenshot only key public routes at desktop
      if (["/", "/research", "/publications", "/lab", "/contact", "/admin"].includes(route)) {
        const name = route === "/" ? "home" : route.replaceAll("/", "_").replace(/^_/, "");
        const shot = path.join(OUT, `desktop-${name || "home"}.png`);
        await page.screenshot({ path: shot });
        results.shots.push(shot);
      }
    } catch (e) {
      entry.error = String(e).slice(0, 180);
    }
    results.routes.push(entry);
  }

  // Research detail page (needs a valid slug from the research index)
  try {
    await page.goto(BASE + "/research", { waitUntil: "networkidle" });
    const slug = await page.evaluate(() => {
      const a = document.querySelector('a[href^="/research/"]');
      return a ? a.getAttribute("href") : null;
    });
    if (slug) {
      await page.goto(BASE + slug, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(900);
      const shot = path.join(OUT, "desktop-research-detail.png");
      await page.screenshot({ path: shot });
      results.shots.push(shot);
      results.researchDetail = {
        slug,
        status: "rendered",
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      };
    }
  } catch (e) {
    results.researchDetail = { error: String(e).slice(0, 180) };
  }

  // Mobile (390x844) + tablet (768x1024) sweep on key routes
  for (const [label, vp] of [
    ["mobile", { width: 390, height: 844 }],
    ["tablet", { width: 768, height: 1024 }],
  ]) {
    await page.setViewportSize(vp);
    for (const route of ["/", "/research", "/lab"]) {
      await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(900);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      results[`${label}-${route.replaceAll("/", "") || "home"}`] = { overflow };
      const shot = path.join(OUT, `${label}-${route === "/" ? "home" : route.replaceAll("/", "_").replace(/^_/, "")}.png`);
      await page.screenshot({ path: shot });
      results.shots.push(shot);
    }
  }

  // Mobile navigation open-state screenshot
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 45000 });
  const menuBtn = page.locator(".mobile-menu-toggle").first();
  if (await menuBtn.count()) {
    await menuBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "mobile-nav-open.png") });
    results.shots.push(path.join(OUT, "mobile-nav-open.png"));
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({
    routes: results.routes.map((r) => `${r.route} ${r.status} ov:${r.overflow}`),
    errorCount: results.errors.length,
    errors: results.errors.slice(0, 12),
    failedRequests: results.failedRequests.slice(0, 12),
    shots: results.shots.length,
  }, null, 2));
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
