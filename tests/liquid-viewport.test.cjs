const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function fixture(pixelRatio = 3) {
  const exports = {};
  const window = { devicePixelRatio: pixelRatio };
  const source = fs.readFileSync(path.join(__dirname, "../src/lib/liquid-viewport.ts"), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, window });
  const parent = { offsetWidth: 390, offsetHeight: 844 };
  const canvas = { style: { touchAction: "none" }, parentElement: parent };
  let allocations = 0;
  const three = {
    isDisposed: false,
    size: { width: 390, height: 844, pixelRatio },
    resize() {
      allocations++;
      this.size = {
        width: parent.offsetWidth,
        height: parent.offsetHeight,
        pixelRatio: Math.min(window.devicePixelRatio, this.maxPixelRatio ?? window.devicePixelRatio),
      };
    },
  };
  exports.configureLiquidViewport({ three }, canvas, true);
  return { exports, window, parent, canvas, three, allocations: () => allocations };
}

test("Mobile liquid caps GPU work and avoids buffer resets for toolbar resize events", () => {
  const f = fixture();
  assert.equal(f.canvas.style.touchAction, "pan-y");
  assert.equal(f.three.maxPixelRatio, 1.25);
  assert.equal(f.three.fpsLimit, 30);
  assert.equal(f.allocations(), 1, "The initial high-DPR buffer is reduced once");
  for (let i = 0; i < 20; i++) f.three.resize();
  assert.equal(f.allocations(), 1, "Toolbar changes cannot reset an unchanged canvas");
});

test("Mobile liquid still resizes for orientation and changed device pixel ratio", () => {
  const f = fixture();
  f.parent.offsetWidth = 844;
  f.parent.offsetHeight = 390;
  f.three.resize();
  assert.equal(f.allocations(), 2);
  assert.equal(f.three.size.width, 844);
  assert.equal(f.three.size.height, 390);
  f.window.devicePixelRatio = 1;
  f.three.resize();
  assert.equal(f.allocations(), 3);
  assert.equal(f.three.size.pixelRatio, 1);
  f.three.resize();
  assert.equal(f.allocations(), 3);
});

test("Late mobile resize callbacks do not use a disposed or detached renderer", () => {
  const f = fixture();
  f.three.isDisposed = true;
  f.parent.offsetWidth = 844;
  f.three.resize();
  assert.equal(f.allocations(), 1);
  f.three.isDisposed = false;
  f.canvas.parentElement = null;
  f.three.resize();
  assert.equal(f.allocations(), 1);
});

test("Desktop liquid keeps the original render configuration", () => {
  const f = fixture();
  const canvas = { style: { touchAction: "none" } };
  const three = { resize() { throw new Error("Desktop should retain its existing sizing"); } };
  const resize = three.resize;
  f.exports.configureLiquidViewport({ three }, canvas, false);
  assert.equal(canvas.style.touchAction, "pan-y");
  assert.equal(three.resize, resize);
  assert.equal(three.maxPixelRatio, undefined);
  assert.equal(three.fpsLimit, undefined);
});
