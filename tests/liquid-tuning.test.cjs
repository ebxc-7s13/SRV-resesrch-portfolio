const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture({ stored, blocked = false } = {}) {
  const values = new Map(stored ? [["liquid-tuning", JSON.stringify(stored)]] : []);
  const events = [];
  const modules = {};
  const globals = {
    window: { dispatchEvent: e => events.push(e.type), matchMedia: () => ({ matches: false }) },
    localStorage: {
      getItem: key => { if (blocked) throw new Error("Storage denied"); return values.get(key) ?? null; },
      setItem: (key, value) => { if (blocked) throw new Error("Storage denied"); values.set(key, value); },
    },
    Event: class { constructor(type) { this.type = type; } },
  };
  function load(name) {
    if (modules[name]) return modules[name];
    const exports = modules[name] = {};
    const source = fs.readFileSync(path.join(__dirname, `../src/lib/${name}.ts`), "utf8");
    vm.runInNewContext(ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, { ...globals, exports, require: id => id === "react" ? {} : load(id.replace("./", "")) });
    return exports;
  }
  return { liquid: load("liquid-tuning"), background: load("background-mode"), values, events };
}

test("Liquid starts and resets with the requested material and ripple defaults", () => {
  const f = fixture();
  const assertDefaults = () => {
    const tuning = f.liquid.getLiquidTuning();
    assert.equal(tuning.displacement, 1);
    assert.equal(tuning.metalness, 0);
    assert.equal(tuning.roughness, 0);
    assert.equal(tuning.brightness, 1.85);
    assert.equal(tuning.rain, false);
  };
  assertDefaults();
  f.liquid.setLiquidTuning({ displacement: 8, metalness: 0.8, roughness: 0.6 });
  f.liquid.resetLiquidTuning();
  assertDefaults();
});

test("Selecting Liquid replaces saved tuning before the environment changes", () => {
  const f = fixture({ stored: { brightness: 1.85, displacement: 5.5, metalness: 0.55, roughness: 0.1 } });
  // Selection can precede the first tuning subscription on desktop.
  f.background.setBackgroundMode("liquid");
  assert.equal(f.liquid.getLiquidTuning().metalness, 0);
  assert.equal(f.liquid.getLiquidTuning().roughness, 0);
  assert.equal(f.liquid.getLiquidTuning().displacement, 1);
  assert.deepEqual(f.events, ["portfolio-liquid-tuning", "portfolio-background"]);
  assert.equal(JSON.parse(f.values.get("liquid-tuning")).metalness, 0);
  f.liquid.setLiquidTuning({ metalness: 0.8 });
  f.background.setBackgroundMode("cells");
  assert.equal(f.liquid.getLiquidTuning().metalness, 0.8);
  f.background.setBackgroundMode("liquid");
  assert.equal(f.liquid.getLiquidTuning().metalness, 0);
});

test("Liquid selection still applies defaults when storage is unavailable", () => {
  const f = fixture({ blocked: true });
  f.liquid.setLiquidTuning({ metalness: 0.9, displacement: 7 });
  f.background.setBackgroundMode("liquid");
  assert.equal(f.liquid.getLiquidTuning().metalness, 0);
  assert.equal(f.liquid.getLiquidTuning().displacement, 1);
  assert.equal(f.background.getBackgroundMode(), "liquid");
});
