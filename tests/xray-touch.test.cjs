const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the real button handlers in the order mobile browsers deliver
// pointerup, focus transfer, and click. WebGL itself is checked in Chromium.
function handlers() {
  const source = ts.createSourceFile("XrayHero.tsx", fs.readFileSync(path.join(__dirname, "../src/components/xray/XrayHero.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let button;
  const visit = node => {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(source) === "button") button = node;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(button);
  const state = { reveal: false, system: null };
  const globals = {
    intent: { current: false }, touchSelection: { current: false },
    system: { key: "muscles" },
    setPinned: () => {}, setFocused: () => {}, setHovered: () => {},
    scene: { current: {
      setSystem: value => { state.system = value; },
      inspectAtCenter: () => { state.reveal = true; },
      clearInspection: () => { state.reveal = false; },
    } },
  };
  const events = {};
  for (const attribute of button.attributes.properties) {
    if (!ts.isJsxAttribute(attribute) || !attribute.name.getText(source).startsWith("on")) continue;
    const callback = attribute.initializer?.expression;
    if (!callback) continue;
    const code = ts.transpileModule(`(${callback.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    events[attribute.name.getText(source)] = vm.runInNewContext(code, globals);
  }
  return { events, state };
}

test("Touch system inspection survives the previous button losing focus after pointerup", () => {
  const { events, state } = handlers();
  events.onPointerDown?.({ pointerType: "touch" });
  events.onPointerUp({ pointerType: "touch" });
  events.onBlur();
  events.onClick({ detail: 1 });
  assert.equal(state.system, "muscles");
  assert.equal(state.reveal, true, "The newly tapped system must remain revealed after focus transfer");
});

test("Mouse selection keeps pointer-based inspection while keyboard selection remains inspectable", () => {
  const { events, state } = handlers();
  events.onPointerDown?.({ pointerType: "mouse" });
  events.onPointerUp({ pointerType: "mouse" });
  events.onBlur();
  events.onClick({ detail: 1 });
  assert.equal(state.reveal, false);
  events.onKeyDown({ key: "Enter" });
  events.onClick({ detail: 0 });
  assert.equal(state.reveal, true);
  assert.equal(state.system, "muscles");
});
