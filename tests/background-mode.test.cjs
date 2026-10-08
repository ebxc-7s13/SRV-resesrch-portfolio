const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture({ mobile = false, stored = null, blocked = false } = {}) {
  const exports = {};
  const values = new Map(stored === null ? [] : [["background-mode", stored]]);
  const source = fs.readFileSync(path.join(__dirname, "../src/lib/background-mode.ts"), "utf8");
  const window = { matchMedia: () => ({ matches: mobile }), dispatchEvent: () => {} };
  const localStorage = {
    getItem: key => { if (blocked) throw new Error("Storage denied"); return values.get(key) ?? null; },
    setItem: (key, value) => { if (blocked) throw new Error("Storage denied"); values.set(key, value); },
  };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, window, localStorage, Event: class {}, require: () => ({}) });
  return { exports, values };
}

test("Fresh mobile visitors start with Liquid while desktop retains Cells", () => {
  assert.equal(fixture({ mobile: true }).exports.getBackgroundMode(), "liquid");
  assert.equal(fixture().exports.getBackgroundMode(), "cells");
});

test("Explicit saved background choices are preserved on mobile and desktop", () => {
  for (const mobile of [false, true]) {
    for (const stored of ["cells", "liquid", "flux", "prism", "membrane"]) {
      assert.equal(fixture({ mobile, stored }).exports.getBackgroundMode(), stored);
    }
  }
});

test("Invalid or unavailable storage still uses the device default", () => {
  assert.equal(fixture({ mobile: true, stored: "invalid" }).exports.getBackgroundMode(), "liquid");
  assert.equal(fixture({ mobile: true, blocked: true }).exports.getBackgroundMode(), "liquid");
  assert.equal(fixture({ blocked: true }).exports.getBackgroundMode(), "cells");
});

test("Changing the environment continues to persist the explicit choice", () => {
  const f = fixture({ mobile: true });
  f.exports.getBackgroundMode();
  f.exports.setBackgroundMode("flux");
  assert.equal(f.exports.getBackgroundMode(), "flux");
  assert.equal(f.values.get("background-mode"), "flux");
  const blocked = fixture({ mobile: true, blocked: true });
  blocked.exports.getBackgroundMode();
  blocked.exports.setBackgroundMode("cells");
  assert.equal(blocked.exports.getBackgroundMode(), "cells");
});


test("Retired Ambient preferences migrate to the existing device defaults", () => {
  assert.equal(fixture({ stored: "ambient" }).exports.getBackgroundMode(), "cells");
  assert.equal(fixture({ mobile: true, stored: "ambient" }).exports.getBackgroundMode(), "liquid");
});
