const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Execute the component's actual effect with a controlled observer, so this
// regression does not require a WebGL context or an additional DOM dependency.
function occlusionEffect(globals) {
  const filename = path.join(__dirname, "../src/components/background/BackgroundSystem.tsx");
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect" && node.arguments[0]?.getText(source).includes('getElementById("lab")')) {
      callback = node.arguments[0].getText(source);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(callback, "The lab occlusion effect must exist");
  return vm.runInNewContext(`(${callback})`, globals);
}

test("Technical background resumes after leaving an occluding home lab for another route", () => {
  const lab = {};
  let currentLab = lab;
  let occluded = false;
  const observers = [];
  const effect = occlusionEffect({
    setLabOccluded: (value) => { occluded = value; },
    document: { getElementById: () => currentLab },
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(target) { assert.equal(target, lab); }
      disconnect() { this.disconnected = true; }
    },
  });

  const leaveHome = effect();
  observers[0].callback([{ isIntersecting: true }]);
  assert.equal(occluded, true, "An intersecting lab suspends Technical background");
  leaveHome();
  assert.equal(observers[0].disconnected, true);

  currentLab = null;
  assert.equal(effect(), undefined);
  assert.equal(occluded, false, "The previous route cannot keep Technical background suspended");
  assert.equal(observers.length, 1, "A route without the lab needs no observer");

  currentLab = lab;
  const leaveAgain = effect();
  observers[1].callback([{ isIntersecting: true }]);
  assert.equal(occluded, true);
  observers[1].callback([{ isIntersecting: false }]);
  assert.equal(occluded, false, "Returning to the homepage restores normal observation");
  leaveAgain();
});
