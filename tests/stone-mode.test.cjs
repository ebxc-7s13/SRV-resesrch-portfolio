const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");
function load(file) {
  const exports = {};
  const source = fs.readFileSync(path.join(root, file), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, Infinity });
  return exports;
}
const stone = load("src/lib/stone-mode.ts");
// Split a selector list on top-level commas only (respects nested :is()).
function splitTopLevel(list) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === "(") depth++;
    else if (list[i] === ")") depth--;
    else if (list[i] === "," && depth === 0) { out.push(list.slice(start, i)); start = i + 1; }
  }
  out.push(list.slice(start));
  return out;
}
const press = load("src/lib/triple-press.ts");

test("Stone links map internal routes and leave everything else alone", () => {
  const cases = {
    "/": "/stone",
    "/about": "/stone/about",
    "/research/oral-cancer-afi": "/stone/research/oral-cancer-afi",
    "/blog/some-note?ref=1#part": "/stone/blog/some-note?ref=1#part",
    "/#lab": "/stone#lab",
    "/thesis#thesis-1": "/stone/thesis#thesis-1",
    "/lab": "/stone/lab",
  };
  for (const [href, expected] of Object.entries(cases)) assert.equal(stone.toStoneHref(href), expected, href);
  for (const href of ["/stone/about", "/admin", "/admin/posts", "/play", "/lab/models", "/api/contact",
    "/models/anatomy/ATTRIBUTION.md", "/mylogo.png", "#capabilities", "https://example.org/", "//cdn.example/x", "mailto:a@b.c", "/unknown-page"])
    assert.equal(stone.toStoneHref(href), null, href);
});

test("Original paths are recovered from stone paths", () => {
  assert.equal(stone.toOriginalPath("/stone"), "/");
  assert.equal(stone.toOriginalPath("/stone/research/x"), "/research/x");
  assert.equal(stone.toOriginalPath("/about"), "/about");
  assert.equal(stone.isStonePath("/stone"), true);
  assert.equal(stone.isStonePath("/stoneage"), false);
  assert.equal(stone.isStonePath(null), false);
});

test("Three presses within the window complete; slower presses restart", () => {
  const W = press.STONE_PRESS_WINDOW_MS;
  let s = press.initialPressState;
  let r = press.registerPress(s, 1000); assert.deepEqual([r.count, r.complete, r.accepted], [1, false, true]); s = r;
  r = press.registerPress(s, 1000 + W - 1); assert.deepEqual([r.count, r.complete], [2, false]); s = r;
  r = press.registerPress(s, 1000 + 2 * W - 2); assert.equal(r.complete, true, "third press in time completes");
  assert.equal(r.count, 0, "state resets after completion");

  s = press.registerPress(press.initialPressState, 0);
  s = press.registerPress(s, 300);
  r = press.registerPress(s, 300 + W + 1);
  assert.deepEqual([r.count, r.complete], [1, false], "an expired sequence starts over");
});

test("Duplicate events within the debounce window are ignored", () => {
  const s = press.registerPress(press.initialPressState, 500);
  const dup = press.registerPress(s, 500 + press.STONE_PRESS_DEBOUNCE_MS - 1);
  assert.equal(dup.accepted, false);
  assert.equal(dup.count, 1);
  assert.equal(press.STONE_PRESS_COUNT, 3);
  assert.ok(press.STONE_PRESS_WINDOW_MS >= 1200 && press.STONE_PRESS_WINDOW_MS <= 1500);
});

test("Every public route has a stone counterpart and every counterpart re-uses the original page", () => {
  const app = path.join(root, "src/app");
  const pages = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") pages.push(path.relative(app, dir).split(path.sep).join("/"));
    }
  };
  walk(app);
  const originals = pages.filter((p) => !p.startsWith("stone") && !p.startsWith("admin") && !p.startsWith("api") && p !== "play" && p !== "lab/models");
  for (const route of originals) {
    const stonePage = path.join(app, "stone", route, "page.tsx");
    assert.ok(fs.existsSync(stonePage), `missing stone counterpart for /${route}`);
    const source = fs.readFileSync(stonePage, "utf8");
    const target = route ? `${"../".repeat(route.split("/").length + 1)}${route}/page` : "../page";
    assert.ok(source.includes(`from "${target}"`), `/stone/${route} must re-export the original page`);
    if (route) assert.equal(stone.toStoneHref(`/${route.replace(/\[slug\]/, "x")}`), `/stone/${route.replace(/\[slug\]/, "x")}`);
  }
});

test("Stone styles are fully scoped and monochrome", () => {
  const css = ["stone.css", "stone-architecture.css"]
    .map((f) => fs.readFileSync(path.join(root, "src/app/stone", f), "utf8"))
    .join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = css.replace(/@(media|supports)[^{]+\{/g, "").split("}").map((b) => b.split("{")[0].trim()).filter(Boolean);
  for (const selectorList of blocks) {
    if (/^(from|to|\d+%)$/.test(selectorList)) continue;
    for (const selector of splitTopLevel(selectorList)) {
      assert.match(selector.trim(), /^:root\[data-stone\]/, `unscoped selector: ${selector.trim()}`);
    }
  }
  // Every literal colour is a neutral (channel spread <= 18 of 255).
  for (const [, hex] of css.matchAll(/#([0-9a-f]{6})\b/gi)) {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 18, `#${hex} is not a stone neutral`);
  }
  for (const [, r, g, b] of css.matchAll(/rgb\((\d+) (\d+) (\d+)/g))
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 18, `rgb(${r} ${g} ${b}) is not a stone neutral`);
  assert.ok(!/#(000000|ffffff|000|fff)\b/i.test(css), "no pure black or white");
  // The stylesheet is loaded only by the stone layout.
  assert.match(fs.readFileSync(path.join(root, "src/app/stone/layout.tsx"), "utf8"), /import "\.\/stone\.css"/);
  assert.match(fs.readFileSync(path.join(root, "src/app/stone/layout.tsx"), "utf8"), /import "\.\/stone-architecture\.css"/);
  assert.ok(!fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8").includes("stone/stone.css"));
  // Fonts are self-hosted: a build must never depend on Google Fonts responses.
  const layout = fs.readFileSync(path.join(root, "src/app/stone/layout.tsx"), "utf8");
  assert.doesNotMatch(layout, /next\/font\/google/);
  for (const f of ["cinzel-latin.woff2", "eb-garamond-latin.woff2", "eb-garamond-italic-latin.woff2", "OFL-Cinzel.txt", "OFL-EBGaramond.txt"])
    assert.ok(fs.existsSync(path.join(root, "src/app/stone/fonts", f)), f);
});

test("Stone Mode wiring: activation, exit, cursor and 3D overrides", () => {
  const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
  assert.match(read("src/app/about/page.tsx"), /<SrvStoneKey \/>/, "About SRV mark is the key");
  assert.match(read("src/components/stone/SrvStoneKey.tsx"), /onClick=\{onClick\}/, "activation uses click only");
  assert.doesNotMatch(read("src/components/stone/SrvStoneKey.tsx"), /onPointerDown|onMouseDown|onTouchStart/);
  assert.match(read("src/components/stone/StoneShell.tsx"), /data-stone-exit/, "a visible exit exists");
  assert.match(read("src/app/layout.tsx"), /dataset\.stone=''/, "stone attribute is set before paint");
  for (const f of ["chisel.svg", "chisel-active.svg", "chisel.png", "chisel-active.png", "grain.svg", "grain-soft.svg", "cloud.svg", "meander.svg",
    "ashlar.svg", "slab-cracks.svg", "crack-a.svg", "crack-b.svg", "crack-c.svg", "dentils.svg", "pilaster-capital.svg", "pilaster-shaft.svg", "pilaster-base.svg"])
    assert.ok(fs.existsSync(path.join(root, "public/stone", f)), f);
  const lab = read("src/components/lab/StoneMaterials.tsx");
  assert.match(lab, /original\.clone\(\)/, "stone uses material clones");
  assert.match(lab, /mesh\.material = original/, "originals are restored");
  assert.doesNotMatch(lab, /geometry\.|\.position\.|\.scale\.|\.rotation\./, "no geometry or transform changes");
  assert.match(read("src/components/lab/LabScene.tsx"), /\{stone && <StoneMaterials \/>\}/);
  assert.match(read("src/components/xray/createXrayScene.ts"), /options\.stone/);
});
