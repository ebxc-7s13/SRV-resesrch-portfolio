import {
  AdditiveBlending, BufferAttribute, BufferGeometry, InstancedBufferAttribute,
  InstancedBufferGeometry, LineSegments, Mesh, OctahedronGeometry,
  PerspectiveCamera, PlaneGeometry, Points, Scene, ShaderMaterial,
  SRGBColorSpace, Vector3, Vector4, WebGLRenderer,
} from "three";
import type { TechnicalBackgroundMode } from "@/lib/background-mode";
import type { TechnicalTuning } from "@/lib/technical-tuning";
import {
  fluxFragment, fluxVertex, membraneFragment, membraneVertex,
  prismFragment, prismVertex,
} from "./shaders";

const HALF_HEIGHT = Math.tan(22.5 * Math.PI / 180) * 8;
const IMPULSE_COUNT = 6;

export function createTechnicalBackground(
  canvas: HTMLCanvasElement,
  mode: TechnicalBackgroundMode,
  initial: TechnicalTuning,
  reduced: boolean,
  onFailure: () => void,
) {
  const mobile = matchMedia("(max-width: 768px), (pointer: coarse)").matches;
  const renderer = new WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: "low-power" });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(mode === "flux" ? 0x060d13 : 0x070b10);
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 30);
  camera.position.z = 8;
  const pointer = new Vector3(0, 0, 0);
  const pointerTarget = new Vector3(0, 0, 0);
  const impulses = Array.from({ length: IMPULSE_COUNT }, () => new Vector4(0, 0, -100, 0));
  const uniforms = {
    uTime: { value: 0 }, uClock: { value: 0 },
    uPointer: { value: pointer }, uImpulses: { value: impulses },
    uResponse: { value: initial.response }, uAspect: { value: 1 }, uDpr: { value: 1 },
  };
  const geometries: BufferGeometry[] = [];
  const materials: ShaderMaterial[] = [];
  let tuning = initial;
  let disposed = false;
  let lost = false;
  let active = true;
  let frame = 0;
  let previous = 0;
  let impulseIndex = 0;
  let clock = 0;
  let time = 0;
  let width = 0;
  let height = 0;
  let ratio = Math.min(devicePixelRatio || 1, mobile ? 1 : 1.5);
  let samples = 0;
  let sampleTime = 0;
  let slowFrames = 0;
  const frameInterval = 1000 / (mobile ? 30 : 60);

  function material(vertexShader: string, fragmentShader: string, particles = -1, layer = 0) {
    const result = new ShaderMaterial({
      uniforms: particles < 0 ? uniforms : { ...uniforms, uParticles: { value: particles }, uLayer: { value: layer } },
      vertexShader, fragmentShader,
      transparent: particles >= 0,
      depthWrite: particles < 0,
      ...(particles >= 0 ? { blending: AdditiveBlending } : {}),
    });
    materials.push(result);
    return result;
  }

  function makeFlux() {
    const strands = mobile ? 64 : 104;
    const segments = mobile ? 144 : 216;
    const coordinates = new Float32Array(strands * segments * 2 * 2);
    let index = 0;
    for (let lane = 0; lane < strands; lane++) {
      for (let step = 0; step < segments; step++) {
        coordinates[index++] = step / segments;
        coordinates[index++] = lane / strands;
        coordinates[index++] = (step + 1) / segments;
        coordinates[index++] = lane / strands;
      }
    }
    const wires = new BufferGeometry();
    wires.setAttribute("position", new BufferAttribute(new Float32Array(coordinates.length / 2 * 3), 3));
    wires.setAttribute("aStrand", new BufferAttribute(coordinates, 2));
    const field = new LineSegments(wires, material(fluxVertex, fluxFragment, 0));
    field.frustumCulled = false;
    scene.add(field);
    const outerField = new LineSegments(wires, material(fluxVertex, fluxFragment, 0, 1));
    outerField.frustumCulled = false;
    scene.add(outerField);
    geometries.push(wires);

    const beadCount = strands * (mobile ? 12 : 20);
    const beads = new Float32Array(beadCount * 2);
    for (let i = 0; i < beadCount; i++) {
      beads[i * 2] = ((i * 0.61803398875) % 1);
      beads[i * 2 + 1] = (i % strands) / strands;
    }
    const electrons = new BufferGeometry();
    electrons.setAttribute("position", new BufferAttribute(new Float32Array(beadCount * 3), 3));
    electrons.setAttribute("aStrand", new BufferAttribute(beads, 2));
    const particles = new Points(electrons, material(fluxVertex, fluxFragment, 1));
    particles.frustumCulled = false;
    scene.add(particles);
    geometries.push(electrons);
  }

  function makePrism(aspect: number) {
    const spacing = mobile ? 0.34 : 0.28;
    const columns = Math.ceil((HALF_HEIGHT * 2 * aspect + 3) / spacing);
    const rows = Math.ceil((HALF_HEIGHT * 2 + 3) / spacing);
    const count = columns * rows;
    const offsets = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const i = row * columns + col;
        offsets[i * 3] = (col - columns / 2) * spacing + (row % 2) * spacing / 2;
        offsets[i * 3 + 1] = (row - rows / 2) * spacing;
        offsets[i * 3 + 2] = -0.12;
        seeds[i] = (Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1;
      }
    }
    const shape = new OctahedronGeometry(spacing * 0.65, 0);
    shape.scale(1, 1, 0.9);
    const crystals = new InstancedBufferGeometry();
    crystals.index = shape.index;
    crystals.attributes = shape.attributes;
    crystals.setAttribute("aOffset", new InstancedBufferAttribute(offsets, 3));
    crystals.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
    crystals.instanceCount = count;
    const tiles = new Mesh(crystals, material(prismVertex, prismFragment));
    tiles.frustumCulled = false;
    scene.add(tiles);
    geometries.push(crystals);
    // Attribute ownership has transferred to crystals; the temporary geometry
    // holds no renderer resources and can release its own listeners now.
    shape.dispose();
  }

  function makeMembrane(aspect: number) {
    const foil = new PlaneGeometry(
      (HALF_HEIGHT * 2 + 3) * aspect, HALF_HEIGHT * 2 + 3,
      mobile ? 100 : 220, mobile ? 120 : 170,
    );
    const surface = new Mesh(foil, material(membraneVertex, membraneFragment));
    surface.frustumCulled = false;
    scene.add(surface);
    geometries.push(foil);
  }

  function size() {
    const nextWidth = Math.max(1, canvas.clientWidth);
    const nextHeight = Math.max(1, canvas.clientHeight);
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth; height = nextHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = camera.aspect;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    uniforms.uDpr.value = ratio;
  }

  size();
  // Landscape-sized geometry also covers later resizes/rotation without
  // allocating a new mesh while the user is interacting.
  const coverage = Math.max(camera.aspect, mobile ? 2 : 2.5);
  if (mode === "flux") makeFlux();
  else if (mode === "prism") makePrism(coverage);
  else makeMembrane(coverage);

  const permitted = () => active && !document.hidden && !lost && !disposed
    && document.documentElement.dataset.motion !== "paused";

  function render(delta: number) {
    clock += delta;
    time += delta * tuning.speed;
    uniforms.uTime.value = time;
    uniforms.uClock.value = clock;
    uniforms.uResponse.value = tuning.response;
    pointer.lerp(pointerTarget, 1 - Math.exp(-delta * 7));
    renderer.render(scene, camera);
  }

  function tick(now: number) {
    frame = 0;
    if (!permitted() || reduced) return;
    if (previous && now - previous < frameInterval - 1) {
      frame = requestAnimationFrame(tick);
      return;
    }
    const interval = previous ? (now - previous) / 1000 : frameInterval / 1000;
    previous = now;
    try { render(Math.min(interval, 0.06)); }
    catch { stop(); onFailure(); return; }
    // Drop raster resolution only after sustained frame pressure. Geometry,
    // interaction and scene detail stay intact; this avoids a GPU-heavy bloom
    // stack and never increases the target beyond the original DPR cap.
    samples++; sampleTime += interval;
    if (samples === 90) {
      if (sampleTime / samples > frameInterval / 1000 * 1.65) slowFrames++;
      else slowFrames = 0;
      if (slowFrames >= 2 && ratio > 0.7) {
        ratio = Math.max(0.7, ratio * 0.82);
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        uniforms.uDpr.value = ratio;
        slowFrames = 0;
      }
      samples = 0; sampleTime = 0;
    }
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; previous = 0;
  }

  function sync() {
    stop();
    if (!permitted()) return;
    if (reduced) render(0);
    else frame = requestAnimationFrame(tick);
  }

  function move(event: PointerEvent) {
    if (reduced || !permitted() || !event.isPrimary) return;
    const rect = canvas.getBoundingClientRect();
    pointerTarget.set(
      ((event.clientX - rect.left) / rect.width * 2 - 1) * HALF_HEIGHT * camera.aspect,
      (1 - (event.clientY - rect.top) / rect.height * 2) * HALF_HEIGHT,
      1,
    );
  }

  function press(event: PointerEvent) {
    if (event.button !== 0 || reduced || !permitted() || !event.isPrimary) return;
    move(event);
    impulses[impulseIndex].set(pointerTarget.x, pointerTarget.y, clock, 1);
    impulseIndex = (impulseIndex + 1) % IMPULSE_COUNT;
  }

  function leave() { pointerTarget.z = 0; }
  function release(event: PointerEvent) { if (event.pointerType !== "mouse") leave(); }
  function resize() { if (!disposed && !lost) { size(); if (reduced && permitted()) render(0); } }
  function contextLost(event: Event) { event.preventDefault(); lost = true; stop(); onFailure(); }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerdown", press, { passive: true });
  document.addEventListener("pointerup", release, { passive: true });
  document.addEventListener("pointercancel", leave, { passive: true });
  document.documentElement.addEventListener("pointerleave", leave, { passive: true });
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("portfolio-motion", sync);
  canvas.addEventListener("webglcontextlost", contextLost);

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop(); observer.disconnect();
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerdown", press);
    document.removeEventListener("pointerup", release);
    document.removeEventListener("pointercancel", leave);
    document.documentElement.removeEventListener("pointerleave", leave);
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("portfolio-motion", sync);
    canvas.removeEventListener("webglcontextlost", contextLost);
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(shader => shader.dispose());
    scene.clear(); renderer.dispose(); renderer.forceContextLoss();
  }

  try {
    // Compile synchronously once so invalid GLSL cannot leave a blank live
    // layer. Three reports shader errors through this dedicated callback.
    let shaderFailed = false;
    renderer.debug.onShaderError = (gl, _program, vertex, fragment) => {
      shaderFailed = true;
      if (process.env.NODE_ENV === "development") {
        console.error("Technical background shader", gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment));
      }
    };
    renderer.compile(scene, camera);
    if (shaderFailed) throw new Error("Background shader compilation failed");
    render(0);
    sync();
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    setTuning(next: TechnicalTuning) { tuning = next; if (reduced && permitted()) render(0); },
    setActive(next: boolean) { active = next; sync(); },
    dispose,
  };
}
