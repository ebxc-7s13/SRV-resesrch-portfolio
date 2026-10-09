const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture(saved = {}, blocked = false) {
  const exports = {}, values = new Map(Object.entries(saved));
  let snapshots;
  const source = fs.readFileSync(path.join(__dirname, "../src/lib/technical-tuning.ts"), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports, require: () => ({
      useSyncExternalStore: (_subscribe, getSnapshot, getServerSnapshot) => {
        snapshots = { getSnapshot, getServerSnapshot };
        return getServerSnapshot();
      },
    }), Event: class {},
    window: { dispatchEvent() {} },
    localStorage: {
      getItem(key) { if (blocked) throw new Error("Storage denied"); return values.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw new Error("Storage denied"); values.set(key, value); },
    },
  });
  return { api: exports, values, getSnapshots: () => snapshots };
}

const expectedDefaults = mode => ({ brightness: 1, speed: mode === "flux" ? 2 : 1, response: mode === "flux" ? 2 : 1 });
const plain = value => JSON.parse(JSON.stringify(value));

test("Fresh scene tuning and stable server snapshots use the mode defaults", () => {
  const f = fixture();
  for (const mode of ["flux", "prism", "membrane"]) {
    const defaults = f.api.getDefaultTechnicalTuning(mode);
    assert.deepEqual(plain(defaults), expectedDefaults(mode));
    assert.strictEqual(f.api.getDefaultTechnicalTuning(mode), defaults);
    assert.deepEqual(plain(f.api.getTechnicalTuning(mode)), expectedDefaults(mode));
    f.api.useTechnicalTuning(mode);
    const snapshots = f.getSnapshots();
    assert.strictEqual(snapshots.getServerSnapshot(), defaults);
    assert.strictEqual(snapshots.getServerSnapshot(), snapshots.getServerSnapshot());
    assert.strictEqual(snapshots.getSnapshot(), f.api.getTechnicalTuning(mode));
  }
});

test("Partial saved tuning inherits each mode's defaults and preserves valid settings", () => {
  for (const mode of ["flux", "prism", "membrane"]) {
    const partial = fixture({ [`background-${mode}-tuning`]: '{"brightness":0.7}' });
    assert.deepEqual(plain(partial.api.getTechnicalTuning(mode)), { ...expectedDefaults(mode), brightness: 0.7 });
    const valid = { brightness: 0.9, speed: 0.4, response: 1.6 };
    const complete = fixture({ [`background-${mode}-tuning`]: JSON.stringify(valid) });
    assert.deepEqual(plain(complete.api.getTechnicalTuning(mode)), valid);
    complete.api.useTechnicalTuning(mode);
    assert.deepEqual(plain(complete.getSnapshots().getServerSnapshot()), expectedDefaults(mode));
    assert.deepEqual(plain(complete.getSnapshots().getSnapshot()), valid);
  }
});

test("Each technical scene remembers its own tuning and resets independently", () => {
  const { api, values } = fixture();
  api.setTechnicalTuning("flux", { speed: 0.5, response: 1.5 });
  api.setTechnicalTuning("prism", { brightness: 0.65 });
  assert.equal(api.getTechnicalTuning("flux").speed, 0.5);
  assert.equal(api.getTechnicalTuning("prism").speed, 1);
  assert.equal(api.getTechnicalTuning("membrane").brightness, 1);
  api.resetTechnicalTuning("flux");
  assert.deepEqual(plain(api.getTechnicalTuning("flux")), expectedDefaults("flux"));
  assert.deepEqual(JSON.parse(values.get("background-flux-tuning")), expectedDefaults("flux"));
  assert.equal(api.getTechnicalTuning("prism").brightness, 0.65);
  assert.equal(JSON.parse(values.get("background-prism-tuning")).brightness, 0.65);
});

test("Malformed saved settings fall back while numeric extremes are bounded", () => {
  for (const mode of ["flux", "prism", "membrane"]) {
    for (const saved of ["null", "[]", "true", "invalid JSON", '{"speed":"fast"}']) {
      const { api } = fixture({ [`background-${mode}-tuning`]: saved });
      assert.deepEqual(plain(api.getTechnicalTuning(mode)), expectedDefaults(mode));
    }
    const { api } = fixture();
    api.setTechnicalTuning(mode, { speed: NaN, response: Infinity });
    assert.deepEqual(plain(api.getTechnicalTuning(mode)), expectedDefaults(mode));
  }
  const { api } = fixture({ "background-prism-tuning": '{"brightness":900,"speed":-12,"response":1.4}' });
  assert.equal(api.getTechnicalTuning("prism").brightness, 1.6);
  assert.equal(api.getTechnicalTuning("prism").speed, 0);
  assert.equal(api.getTechnicalTuning("prism").response, 1.4);
});

test("Settings still respond when browser storage is denied", () => {
  const { api } = fixture({}, true);
  for (const mode of ["flux", "prism", "membrane"]) {
    assert.deepEqual(plain(api.getTechnicalTuning(mode)), expectedDefaults(mode));
    api.setTechnicalTuning(mode, { brightness: 0.8, speed: 0.25, response: 0.4 });
    api.resetTechnicalTuning(mode);
    assert.deepEqual(plain(api.getTechnicalTuning(mode)), expectedDefaults(mode));
  }
  api.setTechnicalTuning("membrane", { response: 1.75 });
  assert.equal(api.getTechnicalTuning("membrane").response, 1.75);
  api.resetTechnicalTuning("membrane");
  assert.equal(api.getTechnicalTuning("membrane").response, 1);
});
