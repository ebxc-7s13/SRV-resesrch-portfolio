import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Bone,
  Group,
  KeyframeTrack,
  LoopOnce,
  LoopPingPong,
  Matrix4,
  Mesh,
  Object3D,
  QuaternionKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  Vector3,
  VectorKeyframeTrack,
} from "three";

/**
 * Real human motion for the anatomy hero.
 *
 * Clips are CMU motion capture retargeted offline onto a rig fitted to the
 * Z-Anatomy skeleton (scripts/models/z-anatomy/rig.py + retarget.py). Every
 * anatomical layer binds to ONE shared Skeleton, so skin, bones, muscles and
 * nerves always occupy the same pose and the x-ray reveal stays aligned.
 */

type MotionClipData = { name: string; mode: "inplace" | "cycle" | "travel"; frames: number; rotations: string; root: string };
export type MotionData = { format: string; fps: number; bones: string[]; rest: Record<string, number[]>; clips: MotionClipData[] };

const PARENTS: Record<string, string | null> = {
  hips: null, spine: "hips", chest: "spine", upperChest: "chest", neck: "upperChest", head: "neck",
};
for (const s of ["L", "R"]) Object.assign(PARENTS, {
  [`clavicle${s}`]: "upperChest", [`upperArm${s}`]: `clavicle${s}`, [`lowerArm${s}`]: `upperArm${s}`, [`hand${s}`]: `lowerArm${s}`,
  [`upperLeg${s}`]: "hips", [`lowerLeg${s}`]: `upperLeg${s}`, [`foot${s}`]: `lowerLeg${s}`, [`toes${s}`]: `foot${s}`,
});

const PERFORMANCES = ["jump", "sit", "run", "wave", "stretch", "chickenDance", "macarena", "charleston", "peekaboo"] as const;
const SPIN_SPEED = 0.42;
/** Atlas (C1) to the top of the skull, in model units. */
const CROWN = 0.18;
const FADE = 0.45;

function decode(base64: string) {
  const binary = atob(base64), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function validateMotionData(value: unknown): MotionData {
  const data = value as MotionData;
  if (!data || data.format !== "xyz-delta" || typeof data.fps !== "number" || !Array.isArray(data.bones) || !Array.isArray(data.clips)) throw new Error("Invalid motion data");
  for (const bone of data.bones) if (!(bone in PARENTS) || !Array.isArray(data.rest?.[bone])) throw new Error(`Unknown bone ${bone}`);
  for (const name of ["idle", "walk", "sneak", ...PERFORMANCES]) if (!data.clips.some(c => c.name === name)) throw new Error(`Missing clip ${name}`);
  return data;
}

type Travel = { path: Float32Array; frames: number; duration: number };

export interface AnatomyMotion {
  /** Parent this to the same transform as the layers' glTF scenes. */
  readonly rig: Group;
  /** Replace a loaded layer's meshes with skinned meshes on the shared skeleton. */
  bind(layer: Object3D): void;
  /** Advance the clips and the director; read yaw/offset afterwards. */
  update(delta: number): void;
  /** Hold a calm standing pose at centre (face zoom, reduced motion). */
  setHold(hold: boolean, immediate?: boolean): void;
  /** World position of the pelvis, for hit-testing the moving body. */
  pelvis(target: Vector3): Vector3;
  /** World position of the top of the head, for keeping jumps in frame. */
  crown(target: Vector3): Vector3;
  readonly yaw: number;
  readonly offset: Vector3;
  readonly state: string;
  /** Start a named performance now (QA / development tooling). */
  perform(name: string): boolean;
  dispose(): void;
}

export function createAnatomyMotion(data: MotionData, random: () => number = Math.random): AnatomyMotion {
  const rig = new Group();
  rig.name = "anatomy-rig";
  const bones = new Map<string, Bone>();
  for (const name of data.bones) {
    const bone = new Bone();
    bone.name = name;
    bones.set(name, bone);
  }
  for (const name of data.bones) {
    const bone = bones.get(name)!, parent = PARENTS[name], head = data.rest[name];
    if (parent) {
      const p = data.rest[parent];
      bone.position.set(head[0] - p[0], head[1] - p[1], head[2] - p[2]);
      bones.get(parent)!.add(bone);
    } else {
      bone.position.set(head[0], head[1], head[2]);
      rig.add(bone);
    }
  }
  const ordered = data.bones.map(name => bones.get(name)!);
  // Rest bones carry no rotation, so each inverse bind matrix is a pure
  // translation by the joint centre, expressed in the shared model space.
  const inverses = data.bones.map(name => new Matrix4().makeTranslation(-data.rest[name][0], -data.rest[name][1], -data.rest[name][2]));
  const skeleton = new Skeleton(ordered, inverses);

  const mixer = new AnimationMixer(rig);
  const actions = new Map<string, AnimationAction>();
  const travels = new Map<string, Travel>();
  const hipsIndex = data.bones.indexOf("hips");
  for (const clip of data.clips) {
    const deltas = new Int16Array(decode(clip.rotations)), root = new Float32Array(decode(clip.root));
    const n = clip.frames, count = data.bones.length;
    if (deltas.length !== n * count * 3 || root.length !== n * 3) throw new Error(`Corrupt clip ${clip.name}`);
    const times = new Float32Array(n);
    for (let f = 0; f < n; f++) times[f] = f / data.fps;
    const tracks: KeyframeTrack[] = data.bones.map((name, b) => {
      // Per channel: int16 deltas over time (wrapping), w >= 0 implied.
      const values = new Float32Array(n * 4);
      for (let c = 0; c < 3; c++) {
        let v = 0;
        const base = (b * 3 + c) * n;
        for (let f = 0; f < n; f++) {
          v = ((v + deltas[base + f] + 32768) & 0xffff) - 32768;
          values[f * 4 + c] = v / 32767;
        }
      }
      for (let f = 0; f < n; f++) {
        const x = values[f * 4], y = values[f * 4 + 1], z = values[f * 4 + 2];
        values[f * 4 + 3] = Math.sqrt(Math.max(0, 1 - x * x - y * y - z * z));
      }
      return new QuaternionKeyframeTrack(`${name}.quaternion`, times, values);
    });
    const hips = new Float32Array(root);
    if (clip.mode === "travel") {
      // Travel is applied to the whole figure by the director so a following
      // clip never slides back; the clip keeps only the vertical bounce.
      const path = new Float32Array(n * 3);
      for (let f = 0; f < n; f++) {
        path[f * 3] = root[f * 3] - root[0];
        path[f * 3 + 2] = root[f * 3 + 2] - root[2];
        hips[f * 3] = data.rest.hips[0];
        hips[f * 3 + 2] = data.rest.hips[2];
      }
      travels.set(clip.name, { path, frames: n, duration: (n - 1) / data.fps });
    }
    tracks.splice(hipsIndex, 0, new VectorKeyframeTrack("hips.position", times, hips));
    const action = mixer.clipAction(new AnimationClip(clip.name, (n - 1) / data.fps, tracks));
    if (clip.name === "idle") action.setLoop(LoopPingPong, Infinity);
    else { action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; }
    actions.set(clip.name, action);
  }

  // ---- director -----------------------------------------------------------
  let current: AnimationAction = actions.get("idle")!;
  current.play();
  let state = "idle", timer = 2.5, yaw = 0, spinning = true, hold = false, holdNow = false;
  let last: string | null = null, sinceHide = 0;
  const offset = new Vector3(), travelStart = new Vector3(), travelPoint = new Vector3();
  let travel: Travel | null = null, travelYaw = 0, hideAt = 3 + Math.floor(random() * 2);
  let turnFrom = 0, turnTo = 0, turnTime = 0, turnDuration = 0;

  function play(name: string, fade = FADE) {
    const next = actions.get(name)!;
    if (next === current) return;
    next.reset().setEffectiveWeight(1).play();
    if (fade > 0) current.crossFadeTo(next, fade, false);
    else { current.stop(); }
    current = next;
  }
  function turnTowards(target: number, duration: number) {
    // Shortest way round from the turntable's current angle.
    const full = Math.PI * 2;
    let to = target + Math.round((yaw - target) / full) * full;
    if (to - yaw > Math.PI) to -= full; else if (yaw - to > Math.PI) to += full;
    turnFrom = yaw; turnTo = to; turnTime = 0; turnDuration = duration;
  }
  function pickPerformance() {
    const pool = PERFORMANCES.filter(name => name !== last);
    const name = pool[Math.floor(random() * pool.length)];
    last = name;
    return name;
  }
  function startTravel(name: "walk" | "sneak", facing: number, start: Vector3) {
    travel = travels.get(name)!; travelYaw = facing; travelStart.copy(start);
    yaw = facing; offset.copy(start);
    play(name, 0);
  }
  function travelPosition(target: Vector3) {
    if (!travel) return target.copy(offset);
    const t = Math.min(current.time, travel.duration) * data.fps;
    const f = Math.min(Math.floor(t), travel.frames - 2), a = t - f, p = travel.path;
    const x = p[f * 3] + (p[f * 3 + 3] - p[f * 3]) * a, z = p[f * 3 + 2] + (p[f * 3 + 5] - p[f * 3 + 2]) * a;
    const c = Math.cos(travelYaw), s = Math.sin(travelYaw);
    return target.set(travelStart.x + x * c + z * s, 0, travelStart.z - x * s + z * c);
  }
  function finished() { return current.time >= current.getClip().duration - 1e-3; }

  function update(delta: number) {
    mixer.update(delta);
    if (turnDuration > 0) {
      turnTime = Math.min(turnDuration, turnTime + delta);
      const t = turnTime / turnDuration, e = t * t * (3 - 2 * t);
      yaw = turnFrom + (turnTo - turnFrom) * e;
      if (turnTime >= turnDuration) turnDuration = 0;
    } else if (spinning) yaw += delta * SPIN_SPEED;
    if (travel) offset.copy(travelPosition(travelPoint));

    if (hold) {
      // Face zoom: walk nothing, keep the body centred and calm.
      if (state !== "hold") {
        travel = null; state = "hold"; spinning = true;
        turnDuration = 0;
        if (current !== actions.get("idle")) play("idle", holdNow || offset.lengthSq() > 0.01 ? 0 : FADE);
        offset.set(0, 0, 0);
        if (holdNow) mixer.update(0);
      }
      return;
    }
    switch (state) {
      case "hold":
        state = "idle"; timer = 1.5; break;
      case "idle":
        timer -= delta;
        if (timer > 0) break;
        if (++sinceHide >= hideAt) {
          // Exit: face the right edge, walk out of frame, stay hidden.
          sinceHide = 0; hideAt = 3 + Math.floor(random() * 3);
          state = "turnOut"; spinning = false; turnTowards(Math.PI / 2, 0.9);
        } else {
          state = "perform"; play(pickPerformance());
        }
        break;
      case "perform":
        if (finished()) { state = "idle"; timer = 1.2 + random() * 1.8; play("idle"); }
        break;
      case "turnOut":
        if (turnDuration === 0) { state = "exit"; startTravel("walk", Math.PI / 2, offset.set(0, 0, 0)); }
        break;
      case "exit":
        if (finished()) {
          // Out of frame: settle off-screen without any visible slide.
          travel = null; play("idle", 0); state = "hidden"; timer = 1.4 + random() * 1.2;
        }
        break;
      case "hidden":
        timer -= delta;
        if (timer <= 0) {
          // Re-enter sideways from the same edge, facing the viewer.
          const path = travels.get("sneak")!.path, end = (travels.get("sneak")!.frames - 1) * 3;
          state = "enter"; startTravel("sneak", 0, travelStart.set(-path[end], 0, -path[end + 2]));
        }
        break;
      case "enter":
        if (finished()) {
          travel = null; offset.set(0, 0, 0); state = "reveal"; play("peekaboo");
        }
        break;
      case "reveal":
        if (finished()) { state = "idle"; spinning = true; timer = 1.5; play("idle"); }
        break;
    }
  }

  function bind(layer: Object3D) {
    const swaps: [Mesh, SkinnedMesh][] = [];
    layer.traverse(node => {
      if (!(node instanceof Mesh) || node instanceof SkinnedMesh) return;
      const geometry = node.geometry;
      if (!geometry.getAttribute("skinIndex") || !geometry.getAttribute("skinWeight")) return;
      const skinned = new SkinnedMesh(geometry, node.material);
      skinned.name = node.name; skinned.renderOrder = node.renderOrder;
      skinned.position.copy(node.position); skinned.quaternion.copy(node.quaternion); skinned.scale.copy(node.scale);
      skinned.frustumCulled = false;
      node.updateMatrix();
      // Bind in the shared model space: the node's own (dequantization)
      // transform relative to its glTF scene, which the rig mirrors.
      const bindMatrix = new Matrix4();
      for (let o: Object3D | null = node; o && o !== layer; o = o.parent) { o.updateMatrix(); bindMatrix.premultiply(o.matrix); }
      skinned.bind(skeleton, bindMatrix);
      swaps.push([node, skinned]);
    });
    for (const [mesh, skinned] of swaps) {
      const parent = mesh.parent!;
      parent.add(skinned); parent.remove(mesh);
    }
  }

  return {
    rig, bind, update,
    setHold(next: boolean, immediate = false) { hold = next; holdNow = immediate; },
    pelvis(target: Vector3) { bones.get("hips")!.getWorldPosition(target); return target; },
    crown(target: Vector3) { return bones.get("head")!.localToWorld(target.set(0, CROWN, 0)); },
    get yaw() { return yaw; },
    get offset() { return offset; },
    get state() { return state; },
    perform(name: string) {
      if (hold || !actions.has(name) || name === "idle") return false;
      travel = null; offset.set(0, 0, 0); turnDuration = 0; spinning = true;
      if (name === "walk") { state = "turnOut"; spinning = false; turnTowards(Math.PI / 2, 0.01); return true; }
      if (name === "sneak") { state = "hidden"; timer = 0; return true; }
      state = "perform"; play(name); return true;
    },
    dispose() { mixer.stopAllAction(); mixer.uncacheRoot(rig); skeleton.dispose(); },
  };
}
