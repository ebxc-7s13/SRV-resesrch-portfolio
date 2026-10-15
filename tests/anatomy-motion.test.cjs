const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const anatomy = path.join(root, "public/models/anatomy");
const motion = JSON.parse(fs.readFileSync(path.join(anatomy, "anatomy-motion.json"), "utf8"));
const rig = JSON.parse(fs.readFileSync(path.join(anatomy, "anatomy-rig.json"), "utf8"));

// Mirrors the runtime decoder: per-channel int16 deltas, w >= 0 implied.
function decodeClip(clip) {
  const bones = motion.bones.length, n = clip.frames;
  const d = new Int16Array(new Uint8Array(Buffer.from(clip.rotations, "base64")).buffer);
  const r = new Float32Array(new Uint8Array(Buffer.from(clip.root, "base64")).buffer);
  assert.equal(d.length, n * bones * 3, clip.name);
  const q = new Float64Array(n * bones * 4);
  for (let b = 0; b < bones; b++) for (let c = 0; c < 3; c++) {
    let v = 0;
    for (let f = 0; f < n; f++) { v = ((v + d[(b * 3 + c) * n + f] + 32768) & 0xffff) - 32768; q[(f * bones + b) * 4 + c] = v / 32767; }
  }
  for (let i = 0; i < q.length; i += 4) {
    const s = q[i] ** 2 + q[i + 1] ** 2 + q[i + 2] ** 2;
    assert.ok(s <= 1.002, `${clip.name} vector part exceeds a unit quaternion`);
    q[i + 3] = Math.sqrt(Math.max(0, 1 - s));
  }
  return { q, r };
}

// Loads the runtime motion module exactly as shipped (TS -> CJS, real three).
function loadMotionModule() {
  const exports = {};
  const source = fs.readFileSync(path.join(root, "src/components/xray/anatomyMotion.ts"), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(output, { exports, require, atob, Float32Array, Int16Array, Uint8Array, Math, Infinity });
  return exports;
}

function seeded(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

test("Motion data matches the fitted rig and includes every performance", () => {
  assert.deepEqual(motion.bones, rig.bones.map(b => b.name));
  for (const bone of rig.bones) assert.deepEqual(motion.rest[bone.name], bone.head);
  const names = motion.clips.map(c => c.name);
  for (const required of ["idle", "walk", "sneak", "jump", "sit", "run", "wave", "stretch", "chickenDance", "macarena", "charleston", "peekaboo"])
    assert.ok(names.includes(required), required);
  assert.match(motion.license, /CMU Graphics Lab Motion Capture Database/);
  assert.equal(motion.fps, 30);
  assert.equal(motion.format, "xyz-delta");
});

test("Every clip decodes to unit quaternions and a grounded, bounded root path", () => {
  const bones = motion.bones.length;
  for (const clip of motion.clips) {
    const { q, r } = decodeClip(clip);
    assert.equal(q.length, clip.frames * bones * 4, clip.name);
    assert.equal(r.length, clip.frames * 3, clip.name);
    // Consecutive frames stay close: no corrupted or wrapped channel.
    for (let f = 1; f < clip.frames; f++) for (let b = 0; b < bones; b++) {
      const i = (f * bones + b) * 4, j = ((f - 1) * bones + b) * 4;
      const dot = Math.abs(q[i] * q[j] + q[i + 1] * q[j + 1] + q[i + 2] * q[j + 2] + q[i + 3] * q[j + 3]);
      assert.ok(dot > 0.9, `${clip.name} ${motion.bones[b]} jumps between frames (${dot})`);
    }
    let minY = Infinity, maxY = -Infinity;
    for (let f = 0; f < clip.frames; f++) { minY = Math.min(minY, r[f * 3 + 1]); maxY = Math.max(maxY, r[f * 3 + 1]); }
    // Pelvis never sinks through the floor and never leaves the jump envelope.
    assert.ok(minY > 0.1 && maxY < 1.7, `${clip.name} pelvis height ${minY}..${maxY}`);
    const travel = Math.hypot(r[(clip.frames - 1) * 3] - r[0], r[(clip.frames - 1) * 3 + 2] - r[2]);
    if (clip.mode === "travel") assert.ok(travel > 2.5, `${clip.name} must leave the frame (${travel})`);
    else assert.ok(travel < 0.2, `${clip.name} stays on its turntable (${travel})`);
  }
});

test("Standing calibration: the idle pose reproduces the anatomical rest pose", () => {
  const idle = motion.clips.find(c => c.name === "idle");
  const { q, r } = decodeClip(idle);
  for (let b = 0; b < motion.bones.length; b++) {
    const w = q[b * 4 + 3];
    assert.ok(w > 0.999, `${motion.bones[b]} deviates from rest at idle (w=${w})`);
  }
  assert.ok(Math.abs(r[1] - motion.rest.hips[1]) < 0.02, "standing pelvis height matches the body");
});

test("All anatomy layers carry skin influences on the shared skeleton", async () => {
  const { NodeIO } = await import("@gltf-transform/core");
  const { ALL_EXTENSIONS } = await import("@gltf-transform/extensions");
  const { MeshoptDecoder } = await import("meshoptimizer");
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  for (const layer of ["base", "skeleton", "muscles", "nervous"]) for (const tier of ["", "-low"]) {
    const doc = await io.read(path.join(anatomy, `${layer}${tier}.glb`));
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    const joints = prim.getAttribute("JOINTS_0"), weights = prim.getAttribute("WEIGHTS_0");
    assert.ok(joints && weights, `${layer}${tier} is rigged`);
    assert.equal(joints.getCount(), prim.getAttribute("POSITION").getCount());
    const j = [0, 0, 0, 0], w = [0, 0, 0, 0];
    for (let i = 0; i < joints.getCount(); i += 97) {
      joints.getElement(i, j); weights.getElement(i, w);
      assert.ok(j.every(v => v >= 0 && v < motion.bones.length), `${layer}${tier} joint index`);
      assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 0.02, `${layer}${tier} weights sum`);
    }
  }
});

test("The director performs, hides off-screen, returns, and holds for zoom", () => {
  const { createAnatomyMotion, validateMotionData } = loadMotionModule();
  const m = createAnatomyMotion(validateMotionData(motion), seeded(7));
  const seen = new Set();
  let maxOffset = 0, minYaw = Infinity, maxYaw = -Infinity;
  for (let t = 0; t < 240; t += 1 / 30) {
    m.update(1 / 30);
    seen.add(m.state);
    maxOffset = Math.max(maxOffset, Math.hypot(m.offset.x, m.offset.z));
    minYaw = Math.min(minYaw, m.yaw); maxYaw = Math.max(maxYaw, m.yaw);
  }
  for (const state of ["idle", "perform", "turnOut", "exit", "hidden", "enter", "reveal"]) assert.ok(seen.has(state), `visited ${state}`);
  assert.ok(maxOffset > 2.5, "walks out of frame");
  assert.ok(maxYaw - minYaw > Math.PI * 2, "keeps rotating between moves");
  m.setHold(true);
  m.update(1 / 30);
  assert.equal(m.state, "hold");
  assert.equal(Math.hypot(m.offset.x, m.offset.z), 0, "zoom keeps the body centred");
  m.setHold(false);
  m.update(1 / 30);
  assert.equal(m.state, "idle");
  assert.equal(m.perform("not-a-clip"), false);
  m.dispose();
});

test("Motion is wired safely into the anatomy scene", () => {
  const scene = fs.readFileSync(path.join(root, "src/components/xray/createXrayScene.ts"), "utf8");
  assert.match(scene, /reduced \? Promise\.resolve\(null\)/, "reduced motion never downloads or plays motion");
  assert.match(scene, /motion\?\.setHold\(zoomed\)/, "face zoom holds the pose");
  assert.match(scene, /motion\.bind\(gltf\.scene\)/, "every layer binds to the shared skeleton");
  assert.match(scene, /process\.env\.NODE_ENV !== "production"\) Object\.assign\(canvas/, "QA handle is development-only");
  assert.match(fs.readFileSync(path.join(anatomy, "ATTRIBUTION.md"), "utf8"), /CMU Graphics Lab Motion Capture Database/);
});
