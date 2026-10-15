// The site's single audio engine. One lazily created AudioContext (only ever
// from a trusted user gesture), one master → limiter chain, short-lived voices
// that disconnect themselves when they end, and at most one ambient bed.
// Every public function is a safe no-op on the server, before the first
// gesture, while muted, or in browsers without Web Audio.
"use client";

import {
  PANEL_PROFILE,
  PREVIEW_EVENTS,
  SCENE_FAMILIES,
  buildAmbient,
  findSceneProfile,
  findUiProfile,
  interfaceSound,
  sceneTransitionSound,
  type InterfaceCategory,
  type ProfileCategory,
  type SceneFamily,
  type Sound,
  type SoundEvent,
  type Voice,
} from "./sound-profiles";
import {
  getSoundSettings,
  subscribeSoundSettings,
  type SoundSettings,
} from "./sound-settings";

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let unsupported = false;
let master: GainNode | null = null;
let fxBus: GainNode | null = null;
let ambientBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
const curves = new Map<number, Float32Array<ArrayBuffer>>();
const sampleLoads = new Map<string, Promise<void>>();
const samples = new Map<string, AudioBuffer>();
const soundCache = new Map<string, Sound>();
const lastPlayed = new Map<string, number>();
let activeVoices = 0;
const MAX_VOICES = 36;

function audioConstructor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function isAudioSupported() {
  return !unsupported && audioConstructor() !== null;
}

function levels(settings: SoundSettings) {
  // Perceptual curve: slider midpoint is clearly quieter than full scale.
  const masterLevel = settings.enabled ? Math.pow(settings.volume, 1.6) * 0.9 : 0;
  const ambientLevel = settings.ambient ? Math.pow(settings.ambientVolume, 1.6) * 0.8 : 0;
  return { masterLevel, ambientLevel };
}

function applyLevels(settings: SoundSettings) {
  if (!ctx || !master || !ambientBus) return;
  const { masterLevel, ambientLevel } = levels(settings);
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(masterLevel, now, 0.015);
  ambientBus.gain.cancelScheduledValues(now);
  ambientBus.gain.setTargetAtTime(ambientLevel, now, 0.25);
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  if (unsupported) return null;
  const Ctor = audioConstructor();
  if (!Ctor) {
    unsupported = true;
    return null;
  }
  try {
    ctx = new Ctor({ latencyHint: "interactive" });
  } catch {
    unsupported = true;
    return null;
  }
  // Limiter last in the chain: stacked fast interactions can never clip.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 8;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.15;
  master = ctx.createGain();
  master.gain.value = 0;
  fxBus = ctx.createGain();
  ambientBus = ctx.createGain();
  ambientBus.gain.value = 0;
  fxBus.connect(master);
  ambientBus.connect(master);
  master.connect(limiter);
  limiter.connect(ctx.destination);
  applyLevels(getSoundSettings());
  return ctx;
}

/**
 * Create or resume the context. Call only from trusted user-gesture handlers:
 * browsers block audio started any other way, and we never retry or prompt.
 */
export function unlockAudio(): boolean {
  const settings = getSoundSettings();
  // A muted visitor never gets an AudioContext at all.
  if (!settings.enabled && !ctx) return false;
  const c = ensureContext();
  if (!c) return false;
  if (c.state === "suspended" && !document.hidden) {
    c.resume().then(syncAmbient, () => {});
  }
  preloadSelectedSamples(settings);
  syncAmbient();
  return true;
}

function ready(): AudioContext | null {
  if (!ctx || ctx.state === "closed") return null;
  // A context created inside this gesture may still report "suspended" for a
  // tick in some browsers; scheduled voices start as soon as it runs.
  return ctx;
}

function getNoise(c: AudioContext) {
  if (noiseBuffer) return noiseBuffer;
  const length = c.sampleRate;
  noiseBuffer = c.createBuffer(1, length, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

function getCurve(drive: number) {
  const key = Math.round(drive * 20) / 20;
  let curve = curves.get(key);
  if (!curve) {
    const k = key * 40 + 1;
    curve = new Float32Array(new ArrayBuffer(512 * 4));
    for (let i = 0; i < 512; i++) {
      const x = (i / 511) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    curves.set(key, curve);
  }
  return curve;
}

function renderVoice(c: AudioContext, v: Voice, t0: number, destination: AudioNode, scale: number) {
  const at = t0 + (v.at ?? 0);
  const end = at + v.dur;
  const nyquist = c.sampleRate / 2;
  const nodes: AudioNode[] = [];
  let source: AudioScheduledSourceNode;
  let lfo: OscillatorNode | null = null;
  if (v.wave === "noise") {
    const noise = c.createBufferSource();
    noise.buffer = getNoise(c);
    noise.loop = true;
    source = noise;
  } else {
    const osc = c.createOscillator();
    osc.type = v.wave;
    osc.frequency.setValueAtTime(v.f0, at);
    if (v.f1 && v.f1 !== v.f0) osc.frequency.exponentialRampToValueAtTime(v.f1, end);
    if (v.detune) osc.detune.value = v.detune;
    if (v.vib) {
      lfo = c.createOscillator();
      lfo.frequency.value = v.vib[0];
      const depth = c.createGain();
      depth.gain.value = v.vib[1];
      lfo.connect(depth).connect(osc.frequency);
      nodes.push(depth);
    }
    source = osc;
  }
  let tail: AudioNode = source;
  if (v.drive) {
    const shaper = c.createWaveShaper();
    shaper.curve = getCurve(v.drive);
    tail = tail.connect(shaper);
    nodes.push(shaper);
  }
  if (v.filter) {
    const filter = c.createBiquadFilter();
    filter.type = v.filter;
    const from = Math.min(nyquist * 0.9, Math.max(30, v.cutoff ?? v.f0));
    filter.frequency.setValueAtTime(from, at);
    if (v.cutoff1)
      filter.frequency.exponentialRampToValueAtTime(
        Math.min(nyquist * 0.9, Math.max(30, v.cutoff1)),
        end,
      );
    filter.Q.value = v.q ?? 0.7;
    tail = tail.connect(filter);
    nodes.push(filter);
  }
  const env = c.createGain();
  const peak = Math.max(0.0002, v.g * scale);
  const attack = Math.max(0.001, Math.min(v.a ?? 0.004, v.dur * 0.5));
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(peak, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  tail.connect(env).connect(destination);
  nodes.push(env);
  source.start(at);
  source.stop(end + 0.02);
  lfo?.start(at);
  lfo?.stop(end + 0.02);
  activeVoices++;
  source.onended = () => {
    activeVoices--;
    source.disconnect();
    lfo?.disconnect();
    nodes.forEach((node) => node.disconnect());
  };
}

function renderSample(c: AudioContext, layer: NonNullable<Sound["sample"]>, t0: number, destination: AudioNode, scale: number) {
  const buffer = samples.get(layer.src);
  if (!buffer) {
    loadSample(layer.src);
    return;
  }
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = layer.rate ?? 1;
  const env = c.createGain();
  const dur = Math.min(layer.dur, buffer.duration);
  env.gain.setValueAtTime(layer.g * scale, t0);
  env.gain.setValueAtTime(layer.g * scale, t0 + dur * 0.6);
  env.gain.linearRampToValueAtTime(0, t0 + dur);
  source.connect(env).connect(destination);
  source.start(t0, layer.offset ?? 0, dur + 0.02);
  activeVoices++;
  source.onended = () => {
    activeVoices--;
    source.disconnect();
    env.disconnect();
  };
}

function loadSample(src: string) {
  if (!ctx || sampleLoads.has(src)) return;
  const c = ctx;
  sampleLoads.set(
    src,
    fetch(src)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(src))))
      // Callback form keeps older Safari working.
      .then((data) => new Promise<AudioBuffer>((resolve, reject) => c.decodeAudioData(data, resolve, reject)))
      .then((buffer) => {
        samples.set(src, buffer);
      })
      .catch(() => {
        /* the synthesized layers still play; allow a later retry */
        sampleLoads.delete(src);
      }),
  );
}

function preloadSelectedSamples(settings: SoundSettings) {
  if (!ctx || !settings.enabled) return;
  const sources = new Set<string>();
  (["nav", "button", "footer"] as const).forEach((category) => {
    const profile = findUiProfile(category, settings[category]);
    Object.values(profile.samples ?? {}).forEach((layer) => layer && sources.add(layer.src));
  });
  SCENE_FAMILIES.forEach((family) => {
    const sample = findSceneProfile(family, settings.scenes[family]).sample;
    if (sample) sources.add(sample.src);
  });
  sources.forEach(loadSample);
}

/** Render a recipe on the effects bus. Returns whether anything was scheduled. */
export function playRecipe(sound: Sound, options: { delay?: number; scale?: number; destination?: AudioNode } = {}) {
  const c = ready();
  const destination = options.destination ?? fxBus;
  if (!c || !destination) return false;
  if (activeVoices > MAX_VOICES) return false;
  const t0 = c.currentTime + 0.005 + (options.delay ?? 0);
  const scale = options.scale ?? 1;
  try {
    sound.voices.forEach((voice) => renderVoice(c, voice, t0, destination, scale));
    if (sound.sample) renderSample(c, sound.sample, t0, destination, scale);
  } catch {
    return false;
  }
  return true;
}

function cachedInterface(category: InterfaceCategory, profileId: string, event: SoundEvent) {
  const key = `${category}:${profileId}:${event}`;
  let sound = soundCache.get(key);
  if (!sound) {
    const profile = category === "ui" ? PANEL_PROFILE : findUiProfile(category, profileId);
    sound = interfaceSound(profile, event);
    soundCache.set(key, sound);
  }
  return sound;
}

/** Rate limit per category/event so rapid pointer movement cannot pile up. */
function allow(key: string, gapMs: number) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const last = lastPlayed.get(key) ?? -Infinity;
  if (now - last < gapMs) return false;
  lastPlayed.set(key, now);
  return true;
}

/**
 * Play an interface cue using the visitor's selected profile for that
 * category, or an explicit profile (previews and selection auditions).
 */
export function playInterface(
  category: InterfaceCategory,
  event: SoundEvent,
  options: { profile?: string; delay?: number } = {},
) {
  const settings = getSoundSettings();
  if (!settings.enabled) return false;
  if (event === "hover" && !settings.hover) return false;
  if (category === "ui" && !settings.panelSounds) return false;
  if (event === "hover" && activeVoices > MAX_VOICES / 2) return false;
  if (!options.profile && !allow(`${category}:${event}`, event === "hover" ? 55 : 30)) return false;
  const profileId =
    category === "ui" ? PANEL_PROFILE.id : options.profile ?? settings[category as ProfileCategory];
  return playRecipe(cachedInterface(category, profileId, event), { delay: options.delay });
}

/** A short demo sequence of one profile's events, scheduled in audio time. */
export function previewInterfaceProfile(category: ProfileCategory, profileId: string) {
  const settings = getSoundSettings();
  if (!settings.enabled || !ready()) return false;
  PREVIEW_EVENTS[category].forEach((event, index) =>
    playRecipe(cachedInterface(category, profileId, event), { delay: index * 0.3 }),
  );
  return true;
}

export function playSceneTransition(family: SceneFamily, options: { profile?: string; delay?: number; preview?: boolean } = {}) {
  const settings = getSoundSettings();
  if (!settings.enabled) return false;
  if (!options.preview && !settings.transitions) return false;
  if (!options.preview && !allow(`scene:${family}`, 400)) return false;
  const profile = findSceneProfile(family, options.profile ?? settings.scenes[family]);
  return playRecipe(sceneTransitionSound(profile), { delay: options.delay });
}

export function previewSceneProfile(family: SceneFamily, profileId: string) {
  const profile = findSceneProfile(family, profileId);
  const played = playSceneTransition(family, { profile: profileId, preview: true });
  const blip = buildAmbient(profile.character).blip;
  if (played && blip) playRecipe(blip, { delay: 0.9, scale: 2 });
  return played;
}

// ---------------------------------------------------------------------------
// Ambient bed — one at a time, crossfaded, fully torn down when not wanted
// ---------------------------------------------------------------------------

type AmbientHandle = { key: string; stop: () => void };
let ambient: AmbientHandle | null = null;
let ambientScene: SceneFamily | null = null;

function startAmbient(c: AudioContext, family: SceneFamily, profileId: string): AmbientHandle {
  const spec = buildAmbient(findSceneProfile(family, profileId).character);
  const bed = c.createGain();
  bed.gain.value = 0;
  bed.connect(ambientBus!);
  bed.gain.setTargetAtTime(1, c.currentTime, 0.8);
  const sources: AudioScheduledSourceNode[] = [];
  const nodes: AudioNode[] = [bed];
  for (const drone of spec.drones) {
    const osc = c.createOscillator();
    osc.type = drone.wave;
    osc.frequency.value = drone.f;
    osc.detune.value = drone.detune;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = drone.cutoff;
    const gain = c.createGain();
    gain.gain.value = drone.g;
    const lfo = c.createOscillator();
    lfo.frequency.value = drone.lfo[0];
    const depth = c.createGain();
    depth.gain.value = drone.g * drone.lfo[1];
    lfo.connect(depth).connect(gain.gain);
    osc.connect(filter).connect(gain).connect(bed);
    sources.push(osc, lfo);
    nodes.push(filter, gain, depth);
  }
  if (spec.noise) {
    const noise = c.createBufferSource();
    noise.buffer = getNoise(c);
    noise.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = spec.noise.type;
    filter.frequency.value = spec.noise.f;
    filter.Q.value = spec.noise.q;
    const lfo = c.createOscillator();
    lfo.frequency.value = spec.noise.lfo[0];
    const depth = c.createGain();
    depth.gain.value = Math.min(spec.noise.lfo[1], spec.noise.f * 0.8);
    lfo.connect(depth).connect(filter.frequency);
    const gain = c.createGain();
    gain.gain.value = spec.noise.g;
    noise.connect(filter).connect(gain).connect(bed);
    sources.push(noise, lfo);
    nodes.push(filter, depth, gain);
  }
  sources.forEach((source) => source.start());
  let timer: ReturnType<typeof setTimeout> | null = null;
  const scheduleBlip = () => {
    if (!spec.blip) return;
    const [min, max] = spec.every;
    timer = setTimeout(() => {
      if (spec.blip) playRecipe(spec.blip, { destination: bed });
      scheduleBlip();
    }, (min + Math.random() * (max - min)) * 1000);
  };
  scheduleBlip();
  let stopped = false;
  return {
    key: `${family}:${profileId}`,
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer) clearTimeout(timer);
      const now = c.currentTime;
      bed.gain.cancelScheduledValues(now);
      bed.gain.setTargetAtTime(0, now, 0.35);
      sources.forEach((source) => {
        try {
          source.stop(now + 2);
        } catch {
          /* already stopped */
        }
      });
      setTimeout(() => {
        sources.forEach((source) => source.disconnect());
        nodes.forEach((node) => node.disconnect());
      }, 2300);
    },
  };
}

function syncAmbient() {
  const settings = getSoundSettings();
  const c = ctx;
  const wanted =
    c && c.state === "running" && settings.enabled && settings.ambient && ambientScene && !document.hidden
      ? `${ambientScene}:${settings.scenes[ambientScene]}`
      : null;
  if (ambient?.key === wanted) return;
  ambient?.stop();
  ambient = null;
  if (wanted && c && ambientScene) {
    try {
      ambient = startAmbient(c, ambientScene, settings.scenes[ambientScene]);
    } catch {
      ambient = null;
    }
  }
}

/** Which scene family is visibly on screen (null on routes without one). */
export function setAmbientScene(family: SceneFamily | null) {
  ambientScene = family;
  syncAmbient();
}

// ---------------------------------------------------------------------------
// Lifecycle — installed once by the SoundSystem component
// ---------------------------------------------------------------------------

let installs = 0;
let teardown: (() => void) | null = null;

export function installSoundEngine() {
  installs++;
  if (installs === 1) {
    const unsubscribe = subscribeSoundSettings((settings) => {
      applyLevels(settings);
      preloadSelectedSamples(settings);
      syncAmbient();
    });
    // Hidden tabs go silent and stop the ambient bed; it resumes on return.
    let suspendedByVisibility = false;
    const onVisibility = () => {
      if (!ctx) return;
      if (document.hidden) {
        syncAmbient();
        if (ctx.state === "running") {
          suspendedByVisibility = true;
          ctx.suspend().catch(() => {});
        }
      } else if (suspendedByVisibility) {
        suspendedByVisibility = false;
        ctx.resume().then(syncAmbient, () => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    teardown = () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      ambient?.stop();
      ambient = null;
    };
  }
  return () => {
    installs--;
    if (installs === 0) {
      teardown?.();
      teardown = null;
    }
  };
}

/** Diagnostics for tests and debugging. */
export function soundEngineState() {
  return {
    supported: isAudioSupported(),
    context: ctx?.state ?? "none",
    activeVoices,
    ambient: ambient?.key ?? null,
  };
}
