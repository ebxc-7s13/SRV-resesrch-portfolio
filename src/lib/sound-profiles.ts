// Sound profile library — pure data, no Web Audio or DOM access.
//
// Every sound on the site is described here as a small synthesis recipe
// (oscillator / noise voices with envelopes, glides and filters) that
// sound-engine.ts renders on demand. Profiles are original procedural
// designs; four short local samples (public/sfx, converted from the Mixkit
// files uploaded to the repository) are layered into a few profiles.
//
// Adding a profile: append a row to the relevant table below. Adding an
// interaction category: extend SoundCategory, its event list and catalog.

export type Wave = "sine" | "triangle" | "square" | "sawtooth" | "noise";
export type FilterKind = "lowpass" | "highpass" | "bandpass";

export type Voice = {
  wave: Wave;
  /** Start frequency in Hz (filter centre for noise voices). */
  f0: number;
  /** End frequency; the voice glides exponentially from f0 to f1. */
  f1?: number;
  /** Start offset in seconds from the trigger time. */
  at?: number;
  /** Total length in seconds, including the release. */
  dur: number;
  /** Attack time in seconds. */
  a?: number;
  /** Peak gain before category and master volume. */
  g: number;
  filter?: FilterKind;
  cutoff?: number;
  cutoff1?: number;
  q?: number;
  detune?: number;
  /** Vibrato: [rate Hz, depth Hz]. */
  vib?: [number, number];
  /** Soft-clip drive, 0..1. */
  drive?: number;
};

export type SampleLayer = {
  src: string;
  offset?: number;
  dur: number;
  g: number;
  rate?: number;
};

export type Sound = { voices: Voice[]; sample?: SampleLayer };

export const SFX = {
  stomp: "/sfx/stomp-impact.mp3",
  hint: "/sfx/interface-hint.mp3",
  plasma: "/sfx/plasma-power-up.mp3",
  transition: "/sfx/tech-transition.mp3",
} as const;

// ---------------------------------------------------------------------------
// Interface categories
// ---------------------------------------------------------------------------

export const UI_EVENTS = {
  nav: ["hover", "click", "select", "open", "close"],
  button: ["hover", "click", "toggleOn", "toggleOff", "confirm"],
  footer: ["hover", "click"],
  ui: ["hover", "click", "select", "open", "close", "toggleOn", "toggleOff"],
} as const;

export type InterfaceCategory = keyof typeof UI_EVENTS;
export type ProfileCategory = Exclude<InterfaceCategory, "ui">;
export type SoundEvent =
  | "hover"
  | "click"
  | "select"
  | "open"
  | "close"
  | "toggleOn"
  | "toggleOff"
  | "confirm";

type Character = {
  wave: Exclude<Wave, "noise">;
  base: number;
  /** Ratio of the second note used by open / select / toggle / confirm. */
  interval: number;
  /** Pitch ratio a click glides to (below 1 falls, above 1 rises). */
  bend: number;
  cutoff: number;
  q?: number;
  /** Noise transient level, 0..1. */
  click?: number;
  /** Sub-oscillator level, 0..1. */
  sub?: number;
  drive?: number;
  length?: number;
  detune?: number;
  vib?: [number, number];
  /** Inharmonic partial ratios (bell / metal colour). */
  partials?: number[];
  /** Stutter count for glitch-style clicks. */
  glitch?: number;
  /** Filter cutoff multiplier swept across a sound. */
  sweep?: number;
  level?: number;
};

export type UiProfile = {
  id: string;
  name: string;
  description: string;
  character: Character;
  samples?: Partial<Record<SoundEvent, SampleLayer>>;
};

const clampF = (f: number) => Math.min(4200, Math.max(40, f));

function body(
  c: Character,
  f0: number,
  f1: number,
  at: number,
  dur: number,
  g: number,
  cutoff = c.cutoff,
  cutoff1 = c.sweep ? c.cutoff * c.sweep : undefined,
): Voice[] {
  const main: Voice = {
    wave: c.wave,
    f0: clampF(f0),
    f1: clampF(f1),
    at,
    dur,
    a: 0.004,
    g,
    filter: "lowpass",
    cutoff,
    cutoff1,
    q: c.q,
    drive: c.drive,
    vib: c.vib,
  };
  const voices = [main];
  if (c.detune) voices.push({ ...main, detune: c.detune, g: g * 0.55 });
  for (const ratio of c.partials ?? [])
    voices.push({
      wave: "sine",
      f0: clampF(f0 * ratio),
      f1: clampF(f1 * ratio),
      at,
      dur: dur * 0.75,
      a: 0.002,
      g: (g * 0.45) / Math.sqrt(ratio),
    });
  return voices;
}

function transient(c: Character, at: number, level: number): Voice[] {
  if (!c.click) return [];
  return [
    {
      wave: "noise",
      f0: 3200,
      at,
      dur: 0.02,
      a: 0.001,
      g: c.click * level,
      filter: "bandpass",
      cutoff: 3200,
      q: 0.8,
    },
  ];
}

function subVoice(c: Character, at: number, L: number, lv: number): Voice[] {
  if (!c.sub) return [];
  const f = Math.max(48, Math.min(110, c.base / 2));
  return [{ wave: "sine", f0: f, f1: Math.max(40, f * 0.7), at, dur: 0.16 * L, a: 0.003, g: c.sub * 0.28 * lv }];
}

/** Derive a coherent event set from one sonic character. */
export function buildInterfaceSound(c: Character, event: SoundEvent): Sound {
  const L = c.length ?? 1;
  const lv = c.level ?? 1;
  const b = c.base;
  const i = c.interval;
  switch (event) {
    case "hover": {
      const f = Math.min(2600, b < 320 ? b * 4 : b * 1.5);
      return {
        voices: [
          {
            wave: c.wave === "sawtooth" ? "triangle" : c.wave,
            f0: f,
            f1: f * (c.bend > 1 ? 1.06 : 0.96),
            dur: 0.035 + 0.02 * L,
            a: 0.002,
            g: 0.05 * lv,
            filter: "lowpass",
            cutoff: Math.min(c.cutoff * 1.4, 6000),
          },
          ...transient(c, 0, 0.04 * lv),
        ],
      };
    }
    case "click": {
      const voices: Voice[] = [];
      if (c.glitch) {
        for (let n = 0; n < c.glitch; n++) {
          const f = b * (n % 2 ? i : 1);
          voices.push(...body(c, f, f * c.bend, n * 0.032, 0.03, 0.16 * lv));
        }
      } else voices.push(...body(c, b, b * c.bend, 0, 0.09 * L, 0.2 * lv));
      voices.push(...subVoice(c, 0, L, lv), ...transient(c, 0, 0.22 * lv));
      return { voices };
    }
    case "select":
      return {
        voices: [
          ...body(c, b * i, b * i * Math.sqrt(c.bend), 0, 0.06 * L, 0.14 * lv),
          ...body(c, b, b * c.bend, 0.045, 0.08 * L, 0.17 * lv),
          ...transient(c, 0, 0.15 * lv),
        ],
      };
    case "open":
      return {
        voices: [
          ...body(c, b * 0.84, b, 0, 0.09 * L, 0.14 * lv, c.cutoff * 0.5, c.cutoff * 1.3),
          ...body(c, b * i, b * i * 1.02, 0.06, 0.13 * L, 0.16 * lv, c.cutoff * 0.7, c.cutoff * 1.4),
          ...subVoice(c, 0, L, lv * 0.7),
        ],
      };
    case "close":
      return {
        voices: [
          ...body(c, b * i, b * i * 0.95, 0, 0.08 * L, 0.14 * lv, c.cutoff * 1.3, c.cutoff * 0.6),
          ...body(c, b, b * 0.8, 0.055, 0.12 * L, 0.13 * lv, c.cutoff, c.cutoff * 0.4),
        ],
      };
    case "toggleOn":
      return {
        voices: [
          ...body(c, b, b * 1.03, 0, 0.05 * L, 0.14 * lv),
          ...body(c, b * i, b * i * 1.01, 0.045, 0.07 * L, 0.15 * lv),
          ...transient(c, 0, 0.12 * lv),
        ],
      };
    case "toggleOff":
      return {
        voices: [
          ...body(c, b * i, b * i * 0.98, 0, 0.05 * L, 0.12 * lv),
          ...body(c, b * 0.8, b * 0.75, 0.045, 0.07 * L, 0.11 * lv),
        ],
      };
    case "confirm":
      return {
        voices: [
          ...body(c, b, b, 0, 0.07, 0.13 * lv),
          ...body(c, b * i, b * i, 0.06, 0.07, 0.13 * lv),
          ...body(c, b * 2, b * 2 * 1.01, 0.12, 0.16 * L, 0.12 * lv),
        ],
      };
  }
}

const P = (
  id: string,
  name: string,
  description: string,
  character: Character,
  samples?: UiProfile["samples"],
): UiProfile => ({ id, name, description, character, samples });

export const NAV_PROFILES: UiProfile[] = [
  P("neon-pulse", "Neon Pulse", "Clean triangle pulses with a soft neon edge.",
    { wave: "triangle", base: 660, interval: 1.5, bend: 0.92, cutoff: 3200, click: 0.15, detune: 6 }),
  P("vice-neon-synth", "Vice Neon Synth", "Detuned saw chords through a warm 80s filter.",
    { wave: "sawtooth", base: 440, interval: 1.26, bend: 0.98, cutoff: 1800, q: 3, detune: 14, length: 1.3, sweep: 1.6, level: 0.8 }),
  P("cyber-bass-impact", "Cyber Bass Impact", "Driven low thumps layered with a short impact sample.",
    { wave: "square", base: 110, interval: 1.5, bend: 0.55, cutoff: 900, sub: 0.8, drive: 0.45, click: 0.35, level: 0.85 },
    { click: { src: SFX.stomp, dur: 0.42, g: 0.3 }, open: { src: SFX.stomp, dur: 0.6, g: 0.34 } }),
  P("holographic-blip", "Holographic Blip", "Bright rising sine blips with a light shimmer.",
    { wave: "sine", base: 1320, interval: 1.335, bend: 1.25, cutoff: 6000, length: 0.6, vib: [11, 18] }),
  P("laser-interface", "Laser Interface", "Fast resonant downward zaps.",
    { wave: "sawtooth", base: 1800, interval: 1.5, bend: 0.25, cutoff: 3600, q: 6, length: 0.8, level: 0.7 },
    { open: { src: SFX.plasma, dur: 0.45, g: 0.26 } }),
  P("analog-console", "Analog Console", "Relay clicks and steady square-wave tones.",
    { wave: "square", base: 520, interval: 1.25, bend: 1, cutoff: 1800, q: 2, click: 0.25, length: 0.9, level: 0.75 }),
  P("digital-confirmation", "Digital Confirmation", "Two-note digital acknowledgements.",
    { wave: "triangle", base: 880, interval: 1.5, bend: 1, cutoff: 5000, glitch: 2 },
    { select: { src: SFX.hint, dur: 0.8, g: 0.32 } }),
  P("magnetic-sweep", "Magnetic Sweep", "Resonant upward filter sweeps.",
    { wave: "sawtooth", base: 300, interval: 1.5, bend: 2.2, cutoff: 1400, q: 8, length: 1.4, sweep: 2.4, level: 0.75 }),
  P("glitch-transition", "Glitch Transition", "Stuttered square fragments with a noise edge.",
    { wave: "square", base: 700, interval: 1.414, bend: 0.9, cutoff: 3000, click: 0.3, glitch: 3, level: 0.75 }),
  P("quantum-navigation", "Quantum Navigation", "Octave-spaced sines with a wavering field.",
    { wave: "sine", base: 523, interval: 2, bend: 1.04, cutoff: 5000, detune: 18, vib: [9, 14], sub: 0.2, length: 1.2 }),
];

export const BUTTON_PROFILES: UiProfile[] = [
  P("capacitive-touch", "Capacitive Touch", "Soft glassy taps, the quietest option.",
    { wave: "sine", base: 1050, interval: 1.335, bend: 0.85, cutoff: 5000, click: 0.1, length: 0.5 }),
  P("glass-terminal", "Glass Terminal", "Bell-like terminal pings with glass partials.",
    { wave: "triangle", base: 1568, interval: 1.5, bend: 0.98, cutoff: 6000, detune: 4, partials: [2.76], length: 0.8, level: 0.8 }),
  P("binary-pulse", "Binary Pulse", "Paired square-wave bits.",
    { wave: "square", base: 760, interval: 1.5, bend: 1, cutoff: 2600, glitch: 2, level: 0.7 }),
  P("sub-bass-click", "Sub-Bass Click", "Tight low clicks with a sub layer.",
    { wave: "sine", base: 95, interval: 1.5, bend: 0.6, cutoff: 700, sub: 0.7, click: 0.3 }),
  P("resonant-synth", "Resonant Synth", "Squelchy resonant saw notes.",
    { wave: "sawtooth", base: 330, interval: 1.335, bend: 0.97, cutoff: 1600, q: 9, sweep: 0.4, length: 1.2, level: 0.75 }),
  P("electric-snap", "Electric Snap", "Short noise-led electrical snaps.",
    { wave: "square", base: 1200, interval: 1.26, bend: 0.4, cutoff: 3600, click: 0.6, drive: 0.3, length: 0.45, level: 0.7 }),
  P("data-transfer", "Data Transfer", "Rapid rising data bursts.",
    { wave: "square", base: 980, interval: 1.25, bend: 1.08, cutoff: 3200, glitch: 4, level: 0.6 },
    { confirm: { src: SFX.hint, dur: 1.2, g: 0.38 } }),
  P("metallic-interface", "Metallic Interface", "Struck-metal tones with inharmonic partials.",
    { wave: "triangle", base: 740, interval: 1.414, bend: 0.99, cutoff: 5000, partials: [2.41, 3.9], length: 1.1, level: 0.8 }),
  P("dual-oscillator-tap", "Dual-Oscillator Tap", "Two detuned oscillators, classic synth tap.",
    { wave: "sawtooth", base: 440, interval: 1.5, bend: 0.94, cutoff: 2200, detune: 25, level: 0.8 }),
  P("futuristic-power-switch", "Futuristic Power Switch", "Rising power-up sweeps for toggles.",
    { wave: "sawtooth", base: 160, interval: 1.9, bend: 1.9, cutoff: 1500, sub: 0.4, drive: 0.25, length: 1.3, sweep: 2, level: 0.75 },
    { toggleOn: { src: SFX.plasma, dur: 0.7, g: 0.28 } }),
];

export const FOOTER_PROFILES: UiProfile[] = [
  P("terminal-micro-click", "Terminal Micro-Click", "Tiny high square ticks.",
    { wave: "square", base: 2000, interval: 1.25, bend: 1, cutoff: 4000, length: 0.3, level: 0.55 }),
  P("soft-neon-tap", "Soft Neon Tap", "Gentle triangle taps.",
    { wave: "triangle", base: 880, interval: 1.5, bend: 0.95, cutoff: 4000, length: 0.5, level: 0.8 }),
  P("micro-chime", "Micro-Chime", "Small bell chimes.",
    { wave: "sine", base: 1760, interval: 1.5, bend: 1, cutoff: 6000, partials: [2.76], length: 1.2, level: 0.7 }),
  P("deep-digital-tap", "Deep Digital Tap", "Low rounded digital taps.",
    { wave: "sine", base: 180, interval: 1.5, bend: 0.7, cutoff: 1200, sub: 0.4, level: 0.9 }),
  P("data-packet", "Data Packet", "Two-bit packet blips.",
    { wave: "square", base: 1100, interval: 1.335, bend: 1, cutoff: 3000, glitch: 2, level: 0.6 }),
  P("metallic-tick", "Metallic Tick", "Short struck-metal ticks.",
    { wave: "triangle", base: 2400, interval: 1.41, bend: 0.98, cutoff: 5000, partials: [2.41], length: 0.35, level: 0.6 }),
  P("soft-synth-bell", "Soft Synth Bell", "Slow-decay synth bells.",
    { wave: "sine", base: 1047, interval: 1.5, bend: 1, cutoff: 5000, partials: [3], detune: 5, length: 1.6, level: 0.75 }),
  P("electric-contact", "Electric Contact", "Crackly contact snaps.",
    { wave: "sawtooth", base: 900, interval: 1.26, bend: 0.5, cutoff: 3000, click: 0.5, length: 0.4, level: 0.65 }),
  P("retro-arcade-click", "Retro Arcade Click", "Two-step 8-bit style clicks.",
    { wave: "square", base: 988, interval: 1.335, bend: 1, cutoff: 3500, glitch: 2, length: 0.8, level: 0.6 }),
  P("quantum-confirmation", "Quantum Confirmation", "Wavering fifth with a soft notification layer.",
    { wave: "sine", base: 659, interval: 1.5, bend: 1.02, cutoff: 5000, vib: [7, 9], length: 1 },
    { click: { src: SFX.hint, dur: 0.6, g: 0.26 } }),
];

/** Fixed, restrained set for the sound panel's own controls. */
export const PANEL_PROFILE: UiProfile = P("panel", "Panel", "Sound panel controls.",
  { wave: "triangle", base: 990, interval: 1.5, bend: 0.94, cutoff: 4500, length: 0.6, level: 0.7 });

export const UI_CATALOG: Record<ProfileCategory, UiProfile[]> = {
  nav: NAV_PROFILES,
  button: BUTTON_PROFILES,
  footer: FOOTER_PROFILES,
};

export function interfaceSound(profile: UiProfile, event: SoundEvent): Sound {
  const sound = buildInterfaceSound(profile.character, event);
  const sample = profile.samples?.[event];
  return sample ? { ...sound, sample } : sound;
}

// ---------------------------------------------------------------------------
// Scene families — one per background mode in lib/background-mode.ts
// ---------------------------------------------------------------------------

export const SCENE_FAMILIES = ["cells", "liquid", "flux", "prism", "membrane"] as const;
export type SceneFamily = (typeof SCENE_FAMILIES)[number];

export const SCENE_LABELS: Record<SceneFamily, string> = {
  cells: "Cells",
  liquid: "Liquid",
  flux: "Flux",
  prism: "Prism",
  membrane: "Membrane",
};

type SceneCharacter = {
  tone: Exclude<Wave, "noise">;
  base: number;
  /** Ratio the tonal layer glides to during a transition. */
  sweep: number;
  noise: number;
  noiseType: FilterKind;
  noiseF: number;
  noiseSweep: number;
  noiseQ: number;
  blips: number;
  blipF: number;
  blipSpread: number;
  blipWave?: Exclude<Wave, "noise">;
  blipGlide?: number;
  partials?: number[];
  vib?: [number, number];
  drive?: number;
  detune?: number;
  length?: number;
};

export type SceneProfile = {
  id: string;
  name: string;
  description: string;
  character: SceneCharacter;
  sample?: SampleLayer;
};

export type AmbientSpec = {
  drones: { wave: Exclude<Wave, "noise">; f: number; detune: number; g: number; cutoff: number; lfo: [number, number] }[];
  noise?: { type: FilterKind; f: number; q: number; g: number; lfo: [number, number] };
  blip?: Sound;
  every: [number, number];
};

export function buildSceneTransition(c: SceneCharacter): Sound {
  const L = c.length ?? 1;
  const voices: Voice[] = [
    {
      wave: c.tone,
      f0: clampF(c.base),
      f1: clampF(c.base * c.sweep),
      dur: 0.55 * L,
      a: 0.08,
      g: 0.1,
      filter: "lowpass",
      cutoff: Math.min(5000, c.base * 6),
      q: 1,
      vib: c.vib,
      drive: c.drive,
    },
  ];
  if (c.detune) voices.push({ ...voices[0], detune: c.detune, g: 0.06 });
  if (c.noise)
    voices.push({
      wave: "noise",
      f0: c.noiseF,
      dur: 0.6 * L,
      a: 0.2 * L,
      g: c.noise * 0.12,
      filter: c.noiseType,
      cutoff: c.noiseF,
      cutoff1: c.noiseF * c.noiseSweep,
      q: c.noiseQ,
    });
  for (let n = 0; n < c.blips; n++) {
    const f = clampF(c.blipF * Math.pow(c.blipSpread, n));
    voices.push({
      wave: c.blipWave ?? "sine",
      f0: f,
      f1: clampF(f * (c.blipGlide ?? 0.98)),
      at: 0.12 + n * 0.07,
      dur: 0.07,
      a: 0.003,
      g: 0.06,
      filter: "lowpass",
      cutoff: 5000,
    });
  }
  for (const ratio of c.partials ?? [])
    voices.push({
      wave: "sine",
      f0: clampF(c.base * c.sweep * ratio),
      at: 0.25 * L,
      dur: 0.35 * L,
      a: 0.01,
      g: 0.04 / Math.sqrt(ratio),
    });
  return { voices };
}

export function buildAmbient(c: SceneCharacter): AmbientSpec {
  const root = Math.max(55, Math.min(220, c.base / 2));
  const drones: AmbientSpec["drones"] = [
    { wave: c.tone, f: root, detune: 0, g: 0.05, cutoff: Math.min(900, root * 4), lfo: [0.07, 0.5] },
    { wave: "sine", f: root * 1.5, detune: c.detune ?? 7, g: 0.03, cutoff: 2000, lfo: [0.11, 0.6] },
  ];
  return {
    drones,
    noise: c.noise
      ? { type: c.noiseType, f: Math.max(120, c.noiseF * 0.6), q: Math.min(c.noiseQ, 8), g: c.noise * 0.05, lfo: [0.05, c.noiseF * 0.3] }
      : undefined,
    blip: c.blips
      ? {
          voices: [
            {
              wave: c.blipWave === "square" || c.blipWave === "sawtooth" ? "triangle" : c.blipWave ?? "sine",
              f0: clampF(c.blipF),
              f1: clampF(c.blipF * (c.blipGlide ?? 0.98)),
              dur: 0.14,
              a: 0.01,
              g: 0.03,
              filter: "lowpass",
              cutoff: 4000,
            },
          ],
        }
      : undefined,
    every: [4, 10],
  };
}

type Row = [string, string, string, SceneCharacter, SampleLayer?];
const scene = (rows: Row[]): SceneProfile[] =>
  rows.map(([id, name, description, character, sample]) => ({ id, name, description, character, sample }));

const C = (
  tone: SceneCharacter["tone"], base: number, sweep: number,
  noise: number, noiseType: FilterKind, noiseF: number, noiseSweep: number, noiseQ: number,
  blips: number, blipF: number, blipSpread: number,
  extra: Partial<SceneCharacter> = {},
): SceneCharacter => ({ tone, base, sweep, noise, noiseType, noiseF, noiseSweep, noiseQ, blips, blipF, blipSpread, ...extra });

export const SCENE_PROFILES: Record<SceneFamily, SceneProfile[]> = {
  cells: scene([
    ["bioelectric-pulse", "Bioelectric Pulse", "Soft rising pulse with bandpassed cellular noise.", C("sine", 220, 1.5, 0.4, "bandpass", 900, 1.8, 2, 2, 880, 1.25)],
    ["cellular-resonance", "Cellular Resonance", "Resonant triangle glide with harmonic overtones.", C("triangle", 196, 1.26, 0.25, "bandpass", 600, 1.4, 6, 0, 0, 1, { partials: [2, 3.01] })],
    ["membrane-shimmer", "Membrane Shimmer", "Shimmering sine with airy noise and tiny pings.", C("sine", 330, 1.12, 0.6, "bandpass", 2400, 1.6, 1.2, 3, 1320, 1.12, { vib: [6, 4] })],
    ["molecular-scanner", "Molecular Scanner", "Scanning resonant sweep with square readouts.", C("triangle", 260, 2, 0.3, "bandpass", 1200, 3, 8, 4, 700, 1.19, { blipWave: "square" })],
    ["neural-spark", "Neural Spark", "Falling sparks with a crackle of noise.", C("sine", 300, 0.8, 0.5, "bandpass", 3000, 0.6, 1.5, 3, 1600, 0.84, { blipWave: "triangle", drive: 0.2 })],
    ["microscopic-signal", "Microscopic Signal", "Steady repeating signal pings.", C("sine", 440, 1, 0.2, "bandpass", 1800, 1, 4, 5, 1100, 1)],
    ["bioluminescent-chime", "Bioluminescent Chime", "Glowing bell arpeggio.", C("sine", 523, 1.5, 0.15, "bandpass", 3000, 1, 2, 3, 1047, 1.335, { partials: [2.76] })],
    ["organic-digital-texture", "Organic Digital Texture", "Filtered square textures with organic noise.", C("square", 180, 1.3, 0.45, "bandpass", 700, 2, 3, 4, 600, 1.5, { blipWave: "square" })],
    ["cellular-energy", "Cellular Energy", "Warm saw energy rise.", C("sawtooth", 147, 1.68, 0.35, "bandpass", 500, 2.5, 4, 2, 588, 1.5, { blipWave: "triangle", drive: 0.15 })],
    ["quantum-biofield", "Quantum Biofield", "Wavering detuned field with soft pings.", C("sine", 247, 1.5, 0.3, "bandpass", 1400, 1.3, 3, 3, 988, 1.2, { detune: 14, vib: [4, 6] })],
  ]),
  liquid: scene([
    ["fluidic-resonance", "Fluidic Resonance", "Low resonant swell through a liquid filter.", C("sine", 174, 1.4, 0.5, "lowpass", 700, 1.8, 5, 2, 620, 1.4)],
    ["liquid-sonar", "Liquid Sonar", "Long sonar ping with a deep wash.", C("sine", 880, 1, 0.2, "lowpass", 400, 1, 1, 2, 1320, 1, { length: 1.4 })],
    ["hydrostatic-pulse", "Hydrostatic Pulse", "Heavy pressure pulse, mostly low end.", C("sine", 110, 0.7, 0.4, "lowpass", 300, 2, 2, 0, 0, 1, { drive: 0.1 })],
    ["droplet-synth", "Droplet Synth", "Upward-chirping droplets.", C("sine", 600, 2.2, 0.1, "bandpass", 2000, 1, 3, 4, 900, 1.3, { blipGlide: 1.6 })],
    ["fluid-propagation", "Fluid Propagation", "Spreading bandpassed wave.", C("triangle", 220, 1.25, 0.6, "bandpass", 800, 2.5, 2, 2, 440, 1.5)],
    ["submerged-scanner", "Submerged Scanner", "Muffled resonant scan under water.", C("triangle", 330, 1.5, 0.45, "lowpass", 500, 1.5, 10, 3, 660, 1, { vib: [3, 5] })],
    ["molecular-ripple", "Molecular Ripple", "Rippling cluster of rising pings.", C("sine", 392, 1.12, 0.3, "bandpass", 1500, 0.7, 4, 5, 784, 1.06, { blipGlide: 1.3 })],
    ["pressure-wave", "Pressure Wave", "Driven low saw wave with a rushing filter.", C("sawtooth", 98, 1.5, 0.5, "lowpass", 250, 3, 3, 0, 0, 1, { drive: 0.2 })],
    ["liquid-energy-sweep", "Liquid Energy Sweep", "Wide energetic fluid sweep.", C("sawtooth", 196, 2, 0.5, "bandpass", 600, 4, 5, 2, 784, 1.5)],
    ["hydro-neon-texture", "Hydro-Neon Texture", "Neon square chords under a liquid filter.", C("square", 262, 1.5, 0.35, "lowpass", 900, 1.5, 6, 3, 1047, 1.19, { detune: 10, blipWave: "triangle" })],
  ]),
  flux: scene([
    ["flux-capacitor-pulse", "Flux Capacitor Pulse", "Charging saw sweep with square sparks.", C("sawtooth", 110, 4, 0.5, "bandpass", 400, 6, 4, 3, 440, 2, { drive: 0.3, blipWave: "square" })],
    ["electromagnetic-sweep", "Electromagnetic Sweep", "Wide resonant EM sweep.", C("sawtooth", 150, 3, 0.6, "bandpass", 300, 10, 9, 0, 0, 1, { vib: [12, 8] })],
    ["quantum-discharge", "Quantum Discharge", "Falling discharge with bright crackle.", C("square", 200, 0.3, 0.7, "highpass", 1200, 2, 1, 2, 1600, 0.6, { drive: 0.35 })],
    ["energy-core", "Energy Core", "Deep core hum with harmonic bloom.", C("sine", 82, 1.5, 0.3, "lowpass", 200, 4, 2, 0, 0, 1, { drive: 0.25, partials: [2, 3] })],
    ["plasma-oscillation", "Plasma Oscillation", "Oscillating plasma tone with a power-up sample.", C("sawtooth", 130, 2, 0.4, "bandpass", 900, 2, 6, 0, 0, 1, { vib: [18, 20] }), { src: SFX.plasma, dur: 1.2, g: 0.32 }],
    ["magnetic-field", "Magnetic Field", "Wobbling detuned field hum.", C("triangle", 98, 1.06, 0.45, "bandpass", 500, 1.2, 12, 0, 0, 1, { vib: [5, 3], detune: 20 })],
    ["reactor-pulse", "Reactor Pulse", "Pulsing low square reactor beats.", C("square", 73, 1, 0.3, "lowpass", 300, 1, 4, 4, 146, 1, { drive: 0.3, blipWave: "square" })],
    ["electric-wave", "Electric Wave", "Crackling high-passed electric wave.", C("sawtooth", 220, 1.5, 0.55, "highpass", 2000, 0.5, 1, 3, 1760, 0.75, { drive: 0.25 })],
    ["phase-shift", "Phase Shift", "Phasing detuned sweep with a transition sample.", C("triangle", 165, 1.414, 0.4, "bandpass", 700, 3, 8, 0, 0, 1, { detune: 30 }), { src: SFX.transition, dur: 1.4, g: 0.36 }],
    ["fusion-resonance", "Fusion Resonance", "Rising fusion tone with a harmonic stack.", C("sawtooth", 110, 2, 0.3, "lowpass", 800, 3, 5, 2, 660, 1.5, { partials: [1.5, 2], drive: 0.15 })],
  ]),
  prism: scene([
    ["crystal-refraction", "Crystal Refraction", "Glassy partials refracting upward.", C("sine", 784, 1.5, 0.15, "highpass", 3000, 1, 1, 3, 1568, 1.12, { partials: [2.76, 5.4] })],
    ["spectral-chime", "Spectral Chime", "Stepping spectral chimes.", C("triangle", 659, 1.335, 0.1, "bandpass", 4000, 1, 2, 4, 1319, 1.122, { partials: [2.76] })],
    ["glass-lattice", "Glass Lattice", "Struck glass lattice tones.", C("sine", 523, 1, 0.1, "bandpass", 3500, 1, 5, 2, 2093, 1.5, { partials: [2.41, 3.9] })],
    ["photon-scatter", "Photon Scatter", "Scattered falling photon pings.", C("sine", 1047, 0.5, 0.3, "highpass", 4000, 0.6, 1, 6, 1400, 1.09)],
    ["laser-diffraction", "Laser Diffraction", "Diffracted laser zap with square fringes.", C("sawtooth", 1200, 0.4, 0.1, "bandpass", 2500, 1, 6, 3, 900, 1.26, { blipWave: "square" })],
    ["facet-shimmer", "Facet Shimmer", "Shimmering facets with airy highs.", C("triangle", 880, 1.06, 0.35, "highpass", 5000, 0.8, 1, 3, 1760, 0.94, { vib: [7, 10] })],
    ["optical-bench", "Optical Bench", "Instrument-like square readouts.", C("square", 392, 1.25, 0.2, "bandpass", 1500, 1, 3, 2, 784, 1.5)],
    ["chromatic-sweep", "Chromatic Sweep", "Broad resonant colour sweep.", C("sawtooth", 262, 3, 0.4, "bandpass", 1000, 5, 7, 0, 0, 1)],
    ["lens-focus", "Lens Focus", "Pulling-focus glide narrowing to a point.", C("sine", 440, 1.5, 0.2, "lowpass", 3000, 0.3, 2, 1, 1760, 1, { detune: 8 })],
    ["prism-resonance", "Prism Resonance", "Resonant prism chord.", C("triangle", 587, 1.5, 0.2, "bandpass", 2500, 1, 4, 3, 1175, 1.19, { partials: [2, 2.76], detune: 6 })],
  ]),
  membrane: scene([
    ["surface-tension", "Surface Tension", "Wobbling surface with soft taps.", C("sine", 196, 1.25, 0.3, "lowpass", 800, 1.5, 6, 2, 392, 1.5, { vib: [5, 4] })],
    ["elastic-wave", "Elastic Wave", "Stretching elastic wave.", C("triangle", 147, 2, 0.4, "bandpass", 400, 3, 5, 0, 0, 1, { vib: [3, 6] })],
    ["bilayer-hum", "Bilayer Hum", "Layered low hum with harmonics.", C("sine", 110, 1, 0.2, "lowpass", 400, 1, 2, 0, 0, 1, { detune: 6, partials: [2, 3], length: 1.3 })],
    ["ion-channel", "Ion Channel", "Gated square channel clicks.", C("square", 330, 1, 0.3, "bandpass", 1500, 1, 6, 5, 660, 1)],
    ["resonant-skin", "Resonant Skin", "Highly resonant membrane ring.", C("triangle", 220, 1.5, 0.5, "bandpass", 700, 1.6, 14, 0, 0, 1)],
    ["osmotic-pulse", "Osmotic Pulse", "Slow pulses settling downward.", C("sine", 165, 1.12, 0.45, "lowpass", 600, 2, 3, 3, 330, 1.12, { blipGlide: 0.8 })],
    ["tensile-ripple", "Tensile Ripple", "Fine ripples across a taut surface.", C("sine", 262, 1.5, 0.3, "bandpass", 1200, 0.6, 3, 4, 523, 1.06, { blipGlide: 1.2 })],
    ["gel-matrix", "Gel Matrix", "Thick detuned gel texture.", C("triangle", 131, 1.5, 0.55, "lowpass", 500, 1.4, 4, 2, 262, 1.5, { detune: 12 })],
    ["vibration-mode", "Vibration Mode", "Vibrating saw mode with an octave.", C("sawtooth", 98, 1.5, 0.3, "lowpass", 600, 2, 5, 0, 0, 1, { vib: [9, 3], partials: [2] })],
    ["diaphragm-drone", "Diaphragm Drone", "Slow, deep diaphragm swell.", C("sine", 82, 1.25, 0.4, "lowpass", 300, 2, 2, 1, 164, 1, { detune: 9, length: 1.4 })],
  ]),
};

export function sceneTransitionSound(profile: SceneProfile): Sound {
  const sound = buildSceneTransition(profile.character);
  return profile.sample ? { ...sound, sample: profile.sample } : sound;
}

// ---------------------------------------------------------------------------
// Lookup and presets
// ---------------------------------------------------------------------------

export function findUiProfile(category: ProfileCategory, id: string): UiProfile {
  const list = UI_CATALOG[category];
  return list.find((p) => p.id === id) ?? list[0];
}

export function findSceneProfile(family: SceneFamily, id: string): SceneProfile {
  const list = SCENE_PROFILES[family];
  return list.find((p) => p.id === id) ?? list[0];
}

export type SoundPreset = {
  id: string;
  name: string;
  nav: string;
  button: string;
  footer: string;
  scenes: Record<SceneFamily, string>;
};

export const SOUND_PRESETS: SoundPreset[] = [
  {
    id: "laboratory",
    name: "Laboratory",
    nav: "neon-pulse",
    button: "capacitive-touch",
    footer: "soft-neon-tap",
    scenes: { cells: "bioelectric-pulse", liquid: "fluidic-resonance", flux: "flux-capacitor-pulse", prism: "crystal-refraction", membrane: "surface-tension" },
  },
  {
    id: "neon-night",
    name: "Neon Night",
    nav: "vice-neon-synth",
    button: "dual-oscillator-tap",
    footer: "retro-arcade-click",
    scenes: { cells: "neural-spark", liquid: "hydro-neon-texture", flux: "plasma-oscillation", prism: "chromatic-sweep", membrane: "vibration-mode" },
  },
  {
    id: "deep-signal",
    name: "Deep Signal",
    nav: "cyber-bass-impact",
    button: "sub-bass-click",
    footer: "deep-digital-tap",
    scenes: { cells: "cellular-energy", liquid: "pressure-wave", flux: "reactor-pulse", prism: "optical-bench", membrane: "diaphragm-drone" },
  },
  {
    id: "minimal",
    name: "Minimal",
    nav: "holographic-blip",
    button: "glass-terminal",
    footer: "terminal-micro-click",
    scenes: { cells: "microscopic-signal", liquid: "liquid-sonar", flux: "magnetic-field", prism: "lens-focus", membrane: "bilayer-hum" },
  },
];

/** Short audition sequence used by preview buttons. */
export const PREVIEW_EVENTS: Record<ProfileCategory, SoundEvent[]> = {
  nav: ["hover", "click", "open", "close"],
  button: ["hover", "click", "toggleOn", "confirm"],
  footer: ["hover", "click"],
};
