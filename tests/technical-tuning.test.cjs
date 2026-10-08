const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture(saved = {}, blocked = false) {
  const exports = {}, values = new Map(Object.entries(saved));
  const source = fs.readFileSync(path.join(__dirname, "../src/lib/technical-tuning.ts"), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports, require: () => ({}), Event: class {},
    window: { dispatchEvent() {} },
    localStorage: {
      getItem(key) { if (blocked) throw new Error("Storage denied"); return values.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw new Error("Storage denied"); values.set(key, value); },
    },
  });
  return { api: exports, values };
}

test("Each technical scene remembers its own tuning and resets independently", () => {
  const { api, values } = fixture();
  api.setTechnicalTuning("flux", { speed: 0.5, response: 1.5 });
  api.setTechnicalTuning("prism", { brightness: 0.65 });
  assert.equal(api.getTechnicalTuning("flux").speed, 0.5);
  assert.equal(api.getTechnicalTuning("prism").speed, 1);
  assert.equal(api.getTechnicalTuning("membrane").brightness, 1);
  api.resetTechnicalTuning("flux");
  assert.equal(api.getTechnicalTuning("flux").speed, 1);
  assert.equal(api.getTechnicalTuning("prism").brightness, 0.65);
  assert.equal(JSON.parse(values.get("background-prism-tuning")).brightness, 0.65);
});

test("Malformed saved settings fall back while numeric extremes are bounded", () => {
  for (const saved of ["null", "[]", "true", "invalid JSON", '{"speed":"fast"}']) {
    const { api } = fixture({ "background-flux-tuning": saved });
    assert.equal(api.getTechnicalTuning("flux").speed, 1);
  }
  const { api } = fixture({ "background-prism-tuning": '{"brightness":900,"speed":-12,"response":1.4}' });
  assert.equal(api.getTechnicalTuning("prism").brightness, 1.6);
  assert.equal(api.getTechnicalTuning("prism").speed, 0);
  assert.equal(api.getTechnicalTuning("prism").response, 1.4);
});

test("Settings still respond when browser storage is denied", () => {
  const { api } = fixture({}, true);
  api.setTechnicalTuning("membrane", { response: 1.75 });
  assert.equal(api.getTechnicalTuning("membrane").response, 1.75);
  api.resetTechnicalTuning("membrane");
  assert.equal(api.getTechnicalTuning("membrane").response, 1);
});
