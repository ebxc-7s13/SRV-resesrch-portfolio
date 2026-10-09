import { ACESFilmicToneMapping, AmbientLight, Box3, BufferGeometry, Color, DirectionalLight, Group, Material, Mesh, MeshStandardMaterial, Object3D, OrthographicCamera, Scene, SRGBColorSpace, Texture, Vector2, Vector3, WebGLRenderer } from "three";
import { getAccentColor, subscribeAccentColor } from "@/lib/accent-color";
import { ACCENT_PALETTES } from "@/lib/accent-palette";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createMeshoptWorker } from "./meshoptWorker";

export type AnatomySystem = "skeleton" | "muscles" | "nervous";
type Layer = "base" | AnatomySystem;
interface XraySceneOptions {
  lowQuality: boolean;
  reducedMotion?: boolean;
  deferPreload?: boolean;
  onReady: () => void;
  onFailure: () => void;
  onSystemState?: (system: AnatomySystem, state: "loading" | "ready" | "error") => void;
}
export interface XraySceneController {
  setActive(active: boolean): void;
  setZoomed(zoomed: boolean): void;
  setSystem(system: AnatomySystem | null): void;
  setReducedMotion(reduced: boolean): void;
  clearInspection(): void;
  inspectAtCenter(): void;
  dispose(): void;
}

/** One camera, renderer, loader, decoder and rigid pivot for all aligned packs. */
export async function createXrayScene(canvas: HTMLCanvasElement, options: XraySceneOptions): Promise<XraySceneController> {
  const scene = new Scene(), camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  const root = new Group(), abort = new AbortController();
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>();
  const cursor = { value: new Vector2() }, cursorRadius = { value: 0 }, cursorReveal = { value: 0 };
  const accentTint = { value: new Color() }, accentEnabled = { value: 0 };
  let unsubscribeAccent: (() => void) | undefined;
  const layers = new Map<Layer, { object: Object3D; material: MeshStandardMaterial }>();
  const pending = new Map<Layer, Promise<void>>();
  const weights: Record<AnatomySystem, number> = { skeleton: 0, muscles: 0, nervous: 0 };
  const bounds = new Box3(), size = new Vector3(1, 2, 1), center = new Vector3(), projected = new Vector3();
  let renderer: WebGLRenderer | undefined, decoder: ReturnType<typeof createMeshoptWorker> | undefined;
  let loader: GLTFLoader | undefined, observer: ResizeObserver | undefined;
  let disposed = false, failed = false, ready = false, active = false, shaderFailed = false;
  let zoomed = false, reduced = !!options.reducedMotion, desired: AnatomySystem | null = "skeleton";
  let revealTarget = 0, viewY = 1, targetY = 1, targetZoom = 1;
  let frame = 0, lastDraw = 0, idleTimer: ReturnType<typeof setTimeout> | undefined;
  let activeTime = 0, slowTime = 0, degraded = false;
  let reportTime = 0, reportFrames = 0, reportIntervals = 0, reportRenderTime = 0;
  let downloads = 0, bytes = 0, parses = 0;
  let telemetryAt = -Infinity;
  const frameInterval = 1000 / (options.lowQuality ? 24 : 30);

  function release(object: Object3D) {
    object.traverse(node => {
      if (!(node instanceof Mesh)) return;
      node.geometry.dispose();
      const list = Array.isArray(node.material) ? node.material : [node.material];
      list.forEach(material => { Object.values(material).forEach(value => { if (value instanceof Texture) value.dispose(); }); material.dispose(); });
    });
  }
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastDraw = 0; activeTime = 0; slowTime = 0;
    reportTime = 0; reportFrames = 0; reportIntervals = 0; reportRenderTime = 0;
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = undefined;
  }
  function dispose() {
    if (disposed) return;
    disposed = true; stop(); abort.abort(); decoder?.dispose(); observer?.disconnect();
    unsubscribeAccent?.();
    canvas.removeEventListener("webglcontextlost", contextLost);
    canvas.removeEventListener("focus", keyboardInspect); canvas.removeEventListener("blur", leave);
    canvas.removeEventListener("pointermove", pointer); canvas.removeEventListener("pointerleave", leave);
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    geometries.clear(); materials.clear(); textures.clear(); layers.clear(); pending.clear(); scene.clear();
    if (renderer) { renderer.debug.onShaderError = null; renderer.dispose(); renderer.forceContextLoss(); renderer = undefined; }
    canvas.dataset.xrayState = failed ? "failed" : "disposed";
  }
  function fail(error?: unknown) {
    if (failed || disposed) return;
    if (process.env.NODE_ENV !== "production" && error) console.warn("Anatomical preview unavailable:", error);
    failed = true; dispose(); options.onFailure();
  }
  function contextLost(event: Event) { event.preventDefault(); fail(); }
  function wake() { if (active && ready && !disposed && !frame) frame = requestAnimationFrame(tick); }
  function setZoomed(next: boolean) {
    if (disposed) return;
    zoomed = next; canvas.dataset.xrayZoom = zoomed ? "face" : "body";
    targetY = zoomed ? bounds.max.y - size.y * 0.08 : center.y;
    targetZoom = zoomed ? 6.5 : 1; wake();
  }
  function setReducedMotion(next: boolean) { reduced = next; canvas.dataset.reducedMotion = String(next); wake(); }
  function setSystem(next: AnatomySystem | null) {
    if (disposed) return;
    desired = next; canvas.dataset.anatomyRequested = next ?? "base";
    if (next) void loadLayer(next).catch(() => {});
    wake();
  }
  function pointer(event: PointerEvent) {
    if (disposed) return;
    if (event.pointerType === "touch") { revealTarget = 0; return; }
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const px = (event.clientX - rect.left) * (canvas.width / rect.width);
    const py = (rect.height - (event.clientY - rect.top)) * (canvas.height / rect.height);
    cursor.value.set(px, py); cursorRadius.value = Math.max(24, Math.min(canvas.width, canvas.height) * 0.17);
    projected.copy(center).project(camera);
    const cx = (projected.x * 0.5 + 0.5) * canvas.width, cy = (projected.y * 0.5 + 0.5) * canvas.height;
    const visibleHeight = (camera.top - camera.bottom) / camera.zoom;
    const silhouette = size.y * 0.52 * (canvas.height / visibleHeight);
    revealTarget = Math.hypot(px - cx, py - cy) <= silhouette ? 1 : 0;
    if (revealTarget && desired && !layers.has(desired) && !pending.has(desired)) void loadLayer(desired).catch(() => {});
    wake();
  }
  function leave() { if (!disposed) { revealTarget = 0; wake(); } }
  function syncAccent() {
    const color = getAccentColor(), channels = ACCENT_PALETTES[color].text;
    accentTint.value.setRGB(channels[0] / 255, channels[1] / 255, channels[2] / 255, SRGBColorSpace);
    accentEnabled.value = color === "green" ? 0 : 1;
    if (ready) renderOnce();
  }
  function applyWindow(material: MeshStandardMaterial, internal: boolean, tintable: boolean) {
    material.onBeforeCompile = shader => {
      shader.uniforms.xrayCursor = cursor; shader.uniforms.xrayRadius = cursorRadius;
      shader.uniforms.xrayReveal = cursorReveal;
      shader.uniforms.xrayAccentTint = accentTint;
      shader.uniforms.xrayAccentEnabled = accentEnabled;
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec2 xrayCursor;\nuniform float xrayRadius;\nuniform float xrayReveal;").replace("#include <alphamap_fragment>", [
        "#include <alphamap_fragment>",
        "float xrayDist = distance(gl_FragCoord.xy, xrayCursor);",
        "float xrayWindow = xrayReveal * (1.0 - smoothstep(xrayRadius * 0.6, xrayRadius, xrayDist));",
        internal ? "diffuseColor.a *= xrayWindow;" : "diffuseColor.a *= (1.0 - xrayWindow);",
        "if (diffuseColor.a < 0.04) discard;",
      ].join("\n"));
      // Theme only the presentation tint, preserving geometry, the reveal
      // window, surface shading and the muscle layer's anatomical colors.
      if (tintable) shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 xrayAccentTint;\nuniform float xrayAccentEnabled;")
        .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))) * xrayAccentTint, xrayAccentEnabled);")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(dot(totalEmissiveRadiance, vec3(0.2126, 0.7152, 0.0722))) * xrayAccentTint, xrayAccentEnabled);");
      if (internal) shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif");
    };
    material.customProgramCacheKey = () => `anatomy-window-${internal ? "internal" : "surface"}-${tintable ? "accent" : "natural"}-v3`;
  }
  function instrument() {
    if (!renderer) return;
    const now = performance.now();
    if (!reduced && now - telemetryAt < 1000) return;
    telemetryAt = now;
    canvas.dataset.xrayDrawCalls = String(renderer.info.render.calls); canvas.dataset.xrayTriangles = String(renderer.info.render.triangles);
    canvas.dataset.anatomyGeometries = String(renderer.info.memory.geometries); canvas.dataset.anatomyTextures = String(renderer.info.memory.textures);
    canvas.dataset.anatomyDownloads = String(downloads); canvas.dataset.anatomyBytes = String(bytes); canvas.dataset.anatomyParses = String(parses);
    canvas.dataset.anatomyLoaded = [...layers.keys()].join(","); canvas.dataset.anatomySystem = desired && layers.has(desired) ? desired : "base";
    canvas.dataset.anatomyRotation = root.rotation.y.toFixed(4); canvas.dataset.anatomyZoom = camera.zoom.toFixed(3);
    canvas.dataset.anatomyViewY = viewY.toFixed(4); canvas.dataset.anatomyReveal = cursorReveal.value.toFixed(3); canvas.dataset.anatomyWeights = JSON.stringify(weights);
  }
  function renderOnce() {
    if (!renderer || disposed) return false;
    try { renderer.render(scene, camera); if (shaderFailed) throw new Error("Anatomical shader compilation failed"); instrument(); return true; }
    catch (error) { fail(error); return false; }
  }
  function resize() {
    if (!renderer || disposed) return;
    const rect = canvas.getBoundingClientRect(), width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height)), aspect = width / height;
    const viewHeight = Math.max(size.y * 1.2, (size.x * 1.16) / aspect);
    camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2; camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix(); renderer.setPixelRatio(degraded ? 0.75 : Math.min(window.devicePixelRatio || 1, options.lowQuality ? 1.25 : 1.5));
    renderer.setSize(width, height, false); if (ready) renderOnce();
  }
  function tick(now: number) {
    frame = 0; if (!active || !ready || disposed) return;
    if (lastDraw && now - lastDraw < (degraded ? 1000 / 24 : frameInterval) - 0.5) { frame = requestAnimationFrame(tick); return; }
    const interval = lastDraw ? now - lastDraw : frameInterval; lastDraw = now;
    const delta = Math.min(interval, 150) / 1000; activeTime += interval;
    if (!reduced) root.rotation.y += delta * 0.42;
    const damping = reduced ? 1 : 1 - Math.exp(-6 * delta);
    camera.zoom += (targetZoom - camera.zoom) * damping; viewY += (targetY - viewY) * damping;
    camera.position.y = viewY; camera.lookAt(center.x, viewY, center.z); camera.updateProjectionMatrix();
    const effective = desired && layers.has(desired) ? desired : null;
    cursorReveal.value += ((effective ? revealTarget : 0) - cursorReveal.value) * (reduced ? 1 : 1 - Math.exp(-14 * delta));
    let moving = Math.abs(targetZoom - camera.zoom) > 0.002 || Math.abs(targetY - viewY) > 0.001;
    for (const key of ["skeleton", "muscles", "nervous"] as const) {
      const target = effective === key ? 1 : 0;
      weights[key] += (target - weights[key]) * (reduced ? 1 : 1 - Math.exp(-14 * delta));
      if (Math.abs(weights[key] - target) < 0.001) weights[key] = target;
      moving ||= Math.abs(weights[key] - target) > 0.001;
      const layer = layers.get(key); if (!layer) continue;
      layer.object.visible = weights[key] > 0.001 && cursorReveal.value > 0.001;
      layer.material.opacity = weights[key];
      layer.material.depthWrite = weights[key] > 0.98;
    }
    const body = layers.get("base");
    if (body) { body.material.opacity = 1; body.material.depthWrite = true; }
    const start = performance.now(); if (!renderOnce() || !renderer) return;
    const renderTime = performance.now() - start; reportIntervals += interval; reportRenderTime += renderTime; reportFrames++;
    if (!reportTime) reportTime = now;
    if (now - reportTime >= 1000) { canvas.dataset.xrayFrameMs = (reportIntervals / reportFrames).toFixed(1); canvas.dataset.xrayRenderMs = (reportRenderTime / reportFrames).toFixed(1); reportTime = now; reportFrames = 0; reportIntervals = 0; reportRenderTime = 0; }
    if (!reduced && activeTime > 3000) {
      const expensive = (interval > 70 && interval < 250) || renderTime > 45;
      slowTime = expensive ? slowTime + Math.min(interval, 150) : Math.max(0, slowTime - 100);
      // Browser scheduling (including another WebGL effect) is not a renderer
      // failure. Reduce resolution/cadence once; retain the interactive body.
      if (slowTime > 2500 && !degraded) { degraded = true; slowTime = 0; activeTime = 0; resize(); }
    }
    moving ||= Math.abs(cursorReveal.value - (effective ? revealTarget : 0)) > 0.001;
    if (!reduced || moving) frame = requestAnimationFrame(tick); else lastDraw = 0;
  }
  function schedulePreload() {
    if (options.lowQuality || reduced || options.deferPreload || layers.has("skeleton") || idleTimer !== undefined) return;
    idleTimer = setTimeout(() => { idleTimer = undefined; if (active && !disposed) void loadLayer("skeleton").catch(() => {}); }, 3000);
  }
  function setActive(next: boolean) {
    if (disposed || active === next) return;
    active = next; stop(); if (!ready) return;
    canvas.dataset.xrayState = active ? "active" : "paused"; if (active) { wake(); schedulePreload(); }
  }
  function loadLayer(key: Layer): Promise<void> {
    if (disposed) return Promise.resolve();
    if (layers.has(key)) { if (key !== "base") options.onSystemState?.(key, "ready"); return Promise.resolve(); }
    const cached = pending.get(key); if (cached) return cached;
    if (key !== "base") options.onSystemState?.(key, "loading");
    const promise = (async () => {
      const response = await fetch(`/models/anatomy/${key}${options.lowQuality ? "-low" : ""}.glb`, { signal: abort.signal });
      if (!response.ok) throw new Error(`Anatomical ${key} asset unavailable`);
      const buffer = await response.arrayBuffer(); downloads++; bytes += buffer.byteLength; if (disposed) return;
      if (!loader) { decoder = createMeshoptWorker(); loader = new GLTFLoader().setMeshoptDecoder(decoder.decoder); }
      const gltf = await loader.parseAsync(buffer, "/models/anatomy/"); parses++;
      if (disposed) { release(gltf.scene); return; }
      const palette = { base: ["#ffffff", "#173e2a", 0.22], skeleton: ["#dcf7bc", "#82ba68", 0.23], muscles: ["#9b8870", "#584a2c", 0.16], nervous: ["#a5dfca", "#57b593", 0.45] } as const;
      const [color, emissive, emissiveIntensity] = palette[key];
      const material = new MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness: 0.68, metalness: 0, transparent: true, depthWrite: key === "base", opacity: key === "base" ? 1 : 0 });
      applyWindow(material, key !== "base", key !== "muscles"); materials.add(material);
      gltf.scene.traverse(node => {
        if (!(node instanceof Mesh)) return;
        geometries.add(node.geometry);
        (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => { Object.values(m).forEach(v => { if (v instanceof Texture) v.dispose(); }); m.dispose(); });
        material.vertexColors = node.geometry.hasAttribute("color");
        node.material = material; node.renderOrder = key === "base" ? 2 : 1; node.castShadow = false; node.receiveShadow = false;
      });
      if (key === "base") {
        bounds.setFromObject(gltf.scene); bounds.getSize(size); bounds.getCenter(center);
        if (!Number.isFinite(size.y) || size.y <= 0) throw new Error("Invalid anatomical bounds"); root.position.copy(center); scene.add(root);
        camera.position.set(center.x, center.y, bounds.max.z + size.y * 3); camera.far = size.y * 8; camera.lookAt(center);
        const ambient = new AmbientLight("#d6e5dc", 1.0), main = new DirectionalLight("#eff8e5", 2.5);
        main.position.set(center.x - size.x * 1.5, bounds.max.y + size.y * 0.4, bounds.max.z + size.y * 2); main.target.position.copy(center);
        scene.add(ambient, main, main.target); viewY = center.y; targetY = center.y; setZoomed(zoomed); resize();
      }
      // Every system uses the SAME base center, never independent fitting.
      gltf.scene.position.sub(center); root.add(gltf.scene); layers.set(key, { object: gltf.scene, material });
      gltf.scene.visible = true; await renderer?.compileAsync(scene, camera); if (disposed) return;
      if (key === "base") { if (!renderOnce()) return; ready = true; canvas.dataset.xrayState = active ? "active" : "paused"; options.onReady(); schedulePreload(); }
      else { gltf.scene.visible = false; options.onSystemState?.(key, "ready"); }
      wake();
    })().catch((error: unknown) => {
      const incomplete = layers.get(key);
      if (!disposed && incomplete) {
        root.remove(incomplete.object); layers.delete(key);
        incomplete.object.traverse(node => { if (node instanceof Mesh) geometries.delete(node.geometry); });
        materials.delete(incomplete.material); release(incomplete.object);
      }
      if (!disposed && key !== "base") { options.onSystemState?.(key, "error"); if (desired === key) { desired = null; wake(); } }
      throw error;
    });
    pending.set(key, promise); return promise;
  }
  try {
    syncAccent(); unsubscribeAccent = subscribeAccentColor(syncAccent);
    canvas.dataset.xrayState = "loading"; canvas.dataset.reducedMotion = String(reduced);
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: !options.lowQuality, powerPreference: "low-power", failIfMajorPerformanceCaveat: true });
    renderer.setClearColor(0x070809, 0); renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = false; renderer.debug.onShaderError = () => { shaderFailed = true; };
    canvas.addEventListener("webglcontextlost", contextLost); canvas.addEventListener("focus", keyboardInspect); canvas.addEventListener("blur", leave); canvas.addEventListener("pointermove", pointer); canvas.addEventListener("pointerleave", leave);
    observer = new ResizeObserver(resize); observer.observe(canvas); resize(); void loadLayer("base").catch(error => { if (!disposed) fail(error); });
  } catch (error) { fail(error); }
  function inspectAtCenter() {
    cursor.value.set(canvas.width / 2, canvas.height / 2);
    cursorRadius.value = Math.max(24, Math.min(canvas.width, canvas.height) * 0.17);
    revealTarget = 1; if (desired) void loadLayer(desired).catch(() => {}); wake();
  }
  function keyboardInspect() { if (canvas.matches(":focus-visible")) inspectAtCenter(); }
  function clearInspection() { revealTarget = 0; wake(); }
  return { setActive, setZoomed, setSystem, setReducedMotion, clearInspection, inspectAtCenter, dispose };
}
