const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Loads the sound modules the same way the other tests load lib files: TS is
// transpiled to CommonJS and run in an isolated context with fake browser
// globals, so storage and audio availability can be controlled per test.
function fixture({ stored = null, blocked = false, audio = false } = {}) {
  const values = new Map(stored === null ? [] : [["sound-settings", stored]]);
  const window = new EventTarget();
  if (audio) window.AudioContext = audio;
  const localStorage = {
    getItem: key => { if (blocked) throw new Error("Storage denied"); return values.get(key) ?? null; },
    setItem: (key, value) => { if (blocked) throw new Error("Storage denied"); values.set(key, value); },
  };
  const document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = (cache[name] = {});
    const source = fs.readFileSync(path.join(__dirname, `../src/lib/${name}.ts`), "utf8");
    vm.runInNewContext(
      ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
      {
        exports, window, document, localStorage, Event, performance, setTimeout, clearTimeout, Math, JSON,
        require: id => (id === "react" ? { useSyncExternalStore: (_s, get) => get() } : load(id.replace("./", ""))),
      },
    );
    return exports;
  }
  return { load, values };
}

const control = overrides => ({
  tag: "button", role: null, type: null, href: false, expanded: null, pressed: null, checked: null,
  inputChecked: null, detailsOpen: null, disabled: false, sound: null, soundEvent: null, region: "page",
  ...overrides,
});

test("Each interface category offers ten distinct, well-formed profiles", () => {
  const profiles = fixture().load("sound-profiles");
  for (const category of ["nav", "button", "footer"]) {
    const list = profiles.UI_CATALOG[category];
    assert.equal(list.length, 10, category);
    assert.equal(new Set(list.map(p => p.id)).size, 10, `${category} ids unique`);
    for (const profile of list) {
      for (const event of profiles.UI_EVENTS[category]) {
        const sound = profiles.interfaceSound(profile, event);
        assert.ok(sound.voices.length > 0, `${profile.id} ${event}`);
        for (const v of sound.voices) {
          assert.ok(Number.isFinite(v.f0) && v.f0 >= 40, `${profile.id} ${event} f0`);
          assert.ok(v.f1 === undefined || (Number.isFinite(v.f1) && v.f1 >= 40));
          assert.ok(v.dur > 0 && v.dur < 1.5, `${profile.id} ${event} duration`);
          assert.ok(v.g > 0 && v.g <= 0.35, `${profile.id} ${event} gain ${v.g}`);
        }
      }
    }
  }
});

test("Events within a profile are distinguishable, and profiles differ", () => {
  const profiles = fixture().load("sound-profiles");
  const sig = s => JSON.stringify(s.voices);
  for (const category of ["nav", "button", "footer"]) {
    for (const profile of profiles.UI_CATALOG[category]) {
      const events = profiles.UI_EVENTS[category].map(e => sig(profiles.interfaceSound(profile, e)));
      assert.equal(new Set(events).size, events.length, `${profile.id} events distinct`);
    }
    const clicks = profiles.UI_CATALOG[category].map(p => sig(profiles.interfaceSound(p, "click")));
    assert.equal(new Set(clicks).size, clicks.length, `${category} clicks distinct`);
  }
});

test("Every background mode has ten scene profiles with transitions and ambience", () => {
  const f = fixture();
  const profiles = f.load("sound-profiles");
  assert.deepEqual([...profiles.SCENE_FAMILIES], ["cells", "liquid", "flux", "prism", "membrane"]);
  for (const family of profiles.SCENE_FAMILIES) {
    const list = profiles.SCENE_PROFILES[family];
    assert.equal(list.length, 10, family);
    assert.equal(new Set(list.map(p => p.id)).size, 10);
    for (const profile of list) {
      const transition = profiles.sceneTransitionSound(profile);
      assert.ok(transition.voices.length > 0);
      for (const v of transition.voices) assert.ok(Number.isFinite(v.f0) && v.g > 0 && v.g <= 0.2);
      const ambient = profiles.buildAmbient(profile.character);
      // Ambience must stay a quiet bed: every layer well below effect levels.
      for (const d of ambient.drones) assert.ok(d.g <= 0.06 && d.f >= 55);
      if (ambient.noise) assert.ok(ambient.noise.g <= 0.05);
    }
  }
});

test("Sample layers only reference the bundled local sfx files", () => {
  const profiles = fixture().load("sound-profiles");
  const sources = new Set();
  for (const list of Object.values(profiles.UI_CATALOG))
    for (const p of list) for (const layer of Object.values(p.samples ?? {})) sources.add(layer.src);
  for (const list of Object.values(profiles.SCENE_PROFILES))
    for (const p of list) if (p.sample) sources.add(p.sample.src);
  assert.ok(sources.size > 0);
  for (const src of sources) {
    assert.match(src, /^\/sfx\/[a-z-]+\.mp3$/);
    assert.ok(fs.existsSync(path.join(__dirname, "../public", src)), src);
  }
});

test("Defaults are restrained: sound on at moderate volume, ambience off", () => {
  const settings = fixture().load("sound-settings").getSoundSettings();
  assert.equal(settings.enabled, true);
  assert.ok(settings.volume <= 0.5);
  assert.equal(settings.ambient, false);
  assert.equal(settings.version, 1);
});

test("Stored settings persist, and invalid or outdated data falls back safely", () => {
  const good = JSON.stringify({ version: 1, enabled: false, volume: 0.8, hover: false, nav: "laser-interface", button: "electric-snap", footer: "micro-chime", scenes: { flux: "phase-shift" }, transitions: false, ambient: true, ambientVolume: 0.2, panelSounds: false });
  const s = fixture({ stored: good }).load("sound-settings").getSoundSettings();
  assert.equal(s.enabled, false);
  assert.equal(s.nav, "laser-interface");
  assert.equal(s.scenes.flux, "phase-shift");
  assert.equal(s.scenes.cells, "bioelectric-pulse");
  assert.equal(s.ambient, true);

  // Objects come from the isolated vm realm: compare their JSON shape.
  const same = (a, b, message) => assert.equal(JSON.stringify(a), JSON.stringify(b), message);
  const defaults = fixture().load("sound-settings").defaultSoundSettings();
  for (const stored of ["{not json", JSON.stringify({ version: 0, enabled: false }), JSON.stringify([1, 2]), "null"]) {
    same(fixture({ stored }).load("sound-settings").getSoundSettings(), defaults, stored);
  }
  const mixed = fixture({ stored: JSON.stringify({ version: 1, volume: 7, nav: "nope", enabled: "yes", scenes: { cells: "flux-capacitor-pulse" } }) })
    .load("sound-settings").getSoundSettings();
  assert.equal(mixed.volume, 1);
  assert.equal(mixed.nav, defaults.nav);
  assert.equal(mixed.enabled, defaults.enabled);
  assert.equal(mixed.scenes.cells, defaults.scenes.cells, "a profile from another family is rejected");
  same(fixture({ blocked: true }).load("sound-settings").getSoundSettings(), defaults);
});

test("Category changes are independent and saved; reset restores defaults", () => {
  const f = fixture();
  const api = f.load("sound-settings");
  const seen = [];
  api.subscribeSoundSettings(s => seen.push(s));
  api.setSoundSettings({ nav: "glitch-transition" });
  api.setSoundSettings({ footer: "data-packet" });
  api.setSceneProfile("liquid", "droplet-synth");
  const s = api.getSoundSettings();
  assert.equal(s.nav, "glitch-transition");
  assert.equal(s.footer, "data-packet");
  assert.equal(s.button, api.defaultSoundSettings().button, "button untouched");
  assert.equal(s.scenes.liquid, "droplet-synth");
  assert.equal(s.scenes.flux, api.defaultSoundSettings().scenes.flux, "other scenes untouched");
  assert.equal(seen.length, 3);
  assert.equal(JSON.parse(f.values.get("sound-settings")).footer, "data-packet");

  api.setSoundSettings({ nav: "not-a-profile" });
  assert.equal(api.getSoundSettings().nav, "glitch-transition", "invalid patch ignored");

  api.applySoundPreset("deep-signal");
  assert.equal(api.getSoundSettings().nav, "cyber-bass-impact");
  assert.equal(api.getSoundSettings().scenes.membrane, "diaphragm-drone");

  api.setSoundSettings({ enabled: false, ambient: true });
  api.resetSoundSettings();
  assert.equal(JSON.stringify(api.getSoundSettings()), JSON.stringify(api.defaultSoundSettings()));

  const blocked = fixture({ blocked: true }).load("sound-settings");
  blocked.setSoundSettings({ volume: 0.1 });
  assert.equal(blocked.getSoundSettings().volume, 0.1, "works in memory without storage");
});

test("Clicks map to the right category and event for each region and control state", () => {
  const { resolveClick, resolveHover } = fixture().load("sound-dispatch");
  const r = o => resolveClick(control(o));
  assert.deepEqual({ ...r({ tag: "a", href: true, region: "nav" }) }, { category: "nav", event: "click" });
  assert.deepEqual({ ...r({ region: "nav" }) }, { category: "nav", event: "select" });
  assert.deepEqual({ ...r({ region: "nav", expanded: "false" }) }, { category: "nav", event: "open" });
  assert.deepEqual({ ...r({ region: "nav", expanded: "true" }) }, { category: "nav", event: "close" });
  assert.deepEqual({ ...r({ region: "nav", soundEvent: "close" }) }, { category: "nav", event: "close" });
  assert.deepEqual({ ...r({ tag: "a", href: true, region: "footer" }) }, { category: "footer", event: "click" });
  assert.deepEqual({ ...r({ region: "footer", expanded: "false" }) }, { category: "footer", event: "click" });
  assert.deepEqual({ ...r({}) }, { category: "button", event: "click" });
  assert.deepEqual({ ...r({ expanded: "false" }) }, { category: "button", event: "toggleOn" });
  assert.deepEqual({ ...r({ pressed: "true" }) }, { category: "button", event: "toggleOff" });
  assert.deepEqual({ ...r({ tag: "input", type: "checkbox", inputChecked: true }) }, { category: "button", event: "toggleOn" });
  assert.deepEqual({ ...r({ tag: "summary", detailsOpen: true }) }, { category: "button", event: "toggleOff" });
  assert.deepEqual({ ...r({ role: "tab" }) }, { category: "button", event: "click" });
  assert.deepEqual({ ...r({ role: "tab", region: "panel" }) }, { category: "ui", event: "select" });
  assert.deepEqual({ ...r({ sound: "footer" }) }, { category: "footer", event: "click" });
  assert.equal(r({ sound: "none" }), null);
  assert.equal(r({ disabled: true }), null);

  assert.deepEqual({ ...resolveHover(control({ tag: "a", href: true, region: "nav" })) }, { category: "nav", event: "hover" });
  assert.equal(resolveHover(control({ region: "panel" })), null, "panel is quiet on hover");
  assert.equal(resolveHover(control({ tag: "input", type: "checkbox" })), null);
  assert.equal(resolveHover(control({ sound: "none" })), null);
});

test("The engine is a safe no-op without Web Audio, before a gesture, and when muted", () => {
  const f = fixture();
  const engine = f.load("sound-engine");
  assert.equal(engine.isAudioSupported(), false);
  assert.equal(engine.unlockAudio(), false);
  assert.equal(engine.playInterface("nav", "click"), false);
  assert.equal(engine.playSceneTransition("flux"), false);
  assert.equal(engine.previewInterfaceProfile("nav", "neon-pulse"), false);
  assert.doesNotThrow(() => engine.setAmbientScene("cells"));
  assert.equal(engine.soundEngineState().context, "none");

  // A browser with audio: nothing is created until unlockAudio() runs, and
  // a muted visitor never gets a context at all.
  let created = 0;
  class FakeContext { constructor() { created++; throw new Error("blocked"); } }
  const muted = fixture({ audio: FakeContext, stored: JSON.stringify({ version: 1, enabled: false }) });
  const mutedEngine = muted.load("sound-engine");
  assert.equal(mutedEngine.playInterface("button", "click"), false);
  assert.equal(mutedEngine.unlockAudio(), false);
  assert.equal(created, 0);

  const failing = fixture({ audio: FakeContext }).load("sound-engine");
  assert.equal(failing.playInterface("button", "click"), false, "no context before a gesture");
  assert.equal(created, 0);
  assert.equal(failing.unlockAudio(), false, "construction failure is contained");
  assert.equal(created, 1);
  assert.equal(failing.unlockAudio(), false);
  assert.equal(created, 1, "a failed context is not retried");
});

test("The sound system is wired into the frame, navigation and contact success", () => {
  const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const frame = read("src/components/PortfolioFrame.tsx");
  assert.equal((frame.match(/<SoundSystem \/>/g) || []).length, 2, "lab and standard frames");
  assert.match(read("src/app/layout.tsx"), /sound-system\.css/);
  assert.match(read("src/components/Navigation.tsx"), /data-sound-event="close"/);
  const contact = read("src/app/contact/page.tsx");
  const okBranch = contact.slice(contact.indexOf("if (res.ok)"), contact.indexOf("} else {", contact.indexOf("if (res.ok)")));
  assert.match(okBranch, /playInterface\("button", "confirm"\)/, "confirm only on success");
  // No component other than the sound system creates audio directly.
  const offenders = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|jsx?)$/.test(entry.name) && !full.includes("sound-engine") && /new (webkit)?AudioContext|new Audio\(/.test(fs.readFileSync(full, "utf8")))
        offenders.push(full);
    }
  };
  walk(path.join(__dirname, "../src"));
  assert.deepEqual(offenders, []);
});
