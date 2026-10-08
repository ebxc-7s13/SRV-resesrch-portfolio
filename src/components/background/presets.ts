// Background system presets — the ONLY place theme/quality/route tuning lives.
// Foreground code must never reach past BackgroundSystem's props.
"use client";

export type BackgroundTheme = "night" | "day" | "blossom";
export type BackgroundQuality = "high" | "medium" | "low";

export type RouteProfile = {
  intensity: number;
  structure: number;
  flowAngle: number;
  signal: number;
  particleScale: number;
};

export type FluidPalette = {
  /** base page tone — stays near --page so text contrast never shifts */
  base: string;
  /** primary fluid body */
  fluid: string;
  /** restrained secondary voice (filament cores, ribbon edges) */
  accent: string;
  /** whisper tone, used sparingly (blossom teal, day lavender) */
  accent2: string;
  /** particle tint */
  particle: string;
  contrast: number;
  brightness: number;
  flowSpeed: number;
  warp: number;
  scale: number;
  grain: number;
  vignette: number;
  particleSize: number;
  particleOpacity: number;
  /** velocity-trail strength (0 disables the ribbon) */
  trail: number;
  /** velocity-trail radius in field units */
  trailRadius: number;
  /** large-scale atmospheric wash (blossom depth, day glass air) */
  atmosphere: number;
  /** filament sharpness exponent (night ink = higher) */
  filamentPow: number;
};

export const FLUID_PRESETS: Record<BackgroundTheme, FluidPalette> = {
  // NIGHT: cyan and violet silk currents with the portfolio's lime signal.
  // Saturated strands sit over a deep navy field to preserve text contrast.
  night: {
    base: "#070b18",
    fluid: "#26e5df",
    accent: "#b7ff4a",
    accent2: "#9c67ff",
    particle: "#aaf4ef",
    contrast: 1.35,
    brightness: 1.12,
    flowSpeed: 0.32,
    warp: 1.6,
    scale: 1.45,
    grain: 0.022,
    vignette: 0.45,
    particleSize: 2.6,
    particleOpacity: 0.5,
    trail: 0.7,
    trailRadius: 0.14,
    atmosphere: 0.055,
    filamentPow: 5.5,
  },
  // DAY: light refractive field — glass, breath, pale cyan.
  day: {
    base: "#f2f7f9",
    fluid: "#9bc4d4",
    accent: "#6a9a3a",
    accent2: "#c5c4dc",
    particle: "#7aadc4",
    contrast: 0.82,
    brightness: 1.01,
    flowSpeed: 0.068,
    warp: 1.18,
    scale: 1.78,
    grain: 0.016,
    vignette: 0.2,
    particleSize: 1.9,
    particleOpacity: 0.27,
    trail: 0.3,
    trailRadius: 0.14,
    atmosphere: 0.12,
    filamentPow: 3.4,
  },
  // BLOSSOM: organic silk — ivory, dusty rose, deep plum, teal whisper.
  blossom: {
    base: "#f8f2f1",
    fluid: "#d8aec0",
    accent: "#9a80a5",
    accent2: "#8db0b5",
    particle: "#c0909c",
    contrast: 0.9,
    brightness: 1.01,
    flowSpeed: 0.05,
    warp: 1.72,
    scale: 1.38,
    grain: 0.019,
    vignette: 0.26,
    particleSize: 2.6,
    particleOpacity: 0.32,
    trail: 0.4,
    trailRadius: 0.17,
    atmosphere: 0.19,
    filamentPow: 3.8,
  },
};

export const QUALITY_PARTICLES: Record<BackgroundQuality, number> = {
  high: 220,
  medium: 140,
  low: 32,
};

// Octave count drives fbm() cost — the shader samples 4+ fbm fields per
// pixel, so each octave is a full-screen noise pass. The fluid is a soft
// diffused field; the 5th octave contributes sub-pixel detail nobody can
// see, so high caps at 4 (was 5) for a straight 20% fragment-cost cut.
export const QUALITY_OCTAVES: Record<BackgroundQuality, number> = {
  high: 4,
  medium: 3,
  low: 2,
};

// DPR is the dominant cost multiplier (fragments scale with DPR²). The field
// is soft/organic — 1.5 vs 1.7 is imperceptible here, and medium at 1.2 keeps
// mid-range GPUs comfortably at 60fps while compositing backdrop blur above.
export const QUALITY_DPR: Record<BackgroundQuality, number> = {
  high: 1.5,
  medium: 1.2,
  low: 1,
};

export const QUALITY_TRAIL: Record<BackgroundQuality, number> = {
  high: 1,
  medium: 0.62,
  low: 0,
};

export function detectQuality(): BackgroundQuality {
  if (typeof window === "undefined") return "medium";
  try {
    const coarse = matchMedia("(pointer: coarse)").matches;
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (connection?.saveData) return "low";
    if (window.innerWidth < 720 || (coarse && window.innerWidth < 1100))
      return "low";
    const memory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory;
    if (
      (memory !== undefined && memory < 8) ||
      (navigator.hardwareConcurrency || 8) < 8
    )
      return "medium";
  } catch {
    /* conservative default below */
  }
  return "high";
}

// Data-saver and genuinely low-end devices skip the WebGL field entirely. The
// CSS fallback already paints the same night composition, so nothing visually
// disappears — but the three.js bundle and its GPU surface never load, which
// is the single largest background cost. Deliberately conservative: only an
// explicit saveData opt-in, or a 2GB / 2-core device, qualifies.
export function prefersLightweightBackground(): boolean {
  if (typeof navigator === "undefined") return false;
  try {
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (connection?.saveData) return true;
    const memory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory;
    if (memory !== undefined && memory <= 2) return true;
    if ((navigator.hardwareConcurrency || 8) <= 2) return true;
  } catch {
    /* unreadable hints — assume the device can carry the field */
  }
  return false;
}

export async function applyBatteryConstraint(
  quality: BackgroundQuality,
): Promise<BackgroundQuality> {
  if (typeof navigator === "undefined" || quality === "low") return quality;
  try {
    const batteryNavigator = navigator as Navigator & {
      getBattery?: () => Promise<{ charging: boolean; level: number }>;
    };
    const battery = await batteryNavigator.getBattery?.();
    if (battery && !battery.charging && battery.level <= 0.25) return "low";
  } catch {
    /* Battery Status is optional and intentionally best-effort. */
  }
  return quality;
}

// Per-route intensity: same language everywhere, calmer where people read
// dense records (publications), more alive on arrival/contact surfaces.
export function routeIntensity(path: string): number {
  return routeProfile(path).intensity;
}

export function routeProfile(path: string): RouteProfile {
  if (path === "/")
    return {
      intensity: 1,
      structure: 0.2,
      flowAngle: -0.04,
      signal: 0.06,
      particleScale: 1,
    };
  if (path === "/research")
    return {
      intensity: 1.08,
      structure: 0.68,
      flowAngle: 0.08,
      signal: 0.08,
      particleScale: 1.08,
    };
  if (path === "/publications" || path === "/thesis")
    return {
      intensity: 0.72,
      structure: 0.12,
      flowAngle: 0,
      signal: 0,
      particleScale: 0.72,
    };
  if (path.startsWith("/research/") || path === "/patents")
    return {
      intensity: 0.92,
      structure: 0.82,
      flowAngle: -0.08,
      signal: 0.12,
      particleScale: 0.82,
    };
  if (path === "/timeline")
    return {
      intensity: 0.94,
      structure: 0.34,
      flowAngle: 0.18,
      signal: 0.36,
      particleScale: 0.88,
    };
  if (path === "/about")
    return {
      intensity: 0.78,
      structure: 0.08,
      flowAngle: 0,
      signal: 0,
      particleScale: 0.68,
    };
  if (path === "/contact")
    return {
      intensity: 1.02,
      structure: 0.22,
      flowAngle: -0.12,
      signal: 0.78,
      particleScale: 0.9,
    };
  if (path.startsWith("/blog"))
    return {
      intensity: 0.74,
      structure: 0.08,
      flowAngle: 0,
      signal: 0.04,
      particleScale: 0.76,
    };
  return {
    intensity: 0.82,
    structure: 0.12,
    flowAngle: 0,
    signal: 0.04,
    particleScale: 0.8,
  };
}

export function parseTheme(_value: string | undefined | null): BackgroundTheme {
  return "night";
}

// Development-only fluid tuning (?bgflow= ?bgwarp= ?bgscale= ?bgmouse=
// ?bgfil= ?bgtrail= ?bgcontrast= ?bgbright= ?bgparticles=). Multipliers around
// 1; bgparticles is an absolute count, -1 keeps the quality preset. Never
// read in production — BackgroundSystem gates on NODE_ENV.
export type FluidTuning = {
  flow: number;
  warp: number;
  scale: number;
  mouse: number;
  filament: number;
  trail: number;
  contrast: number;
  bright: number;
  particles: number;
};

export const DEFAULT_TUNING: FluidTuning = {
  flow: 1,
  warp: 1,
  scale: 1,
  mouse: 1,
  filament: 1,
  trail: 1,
  contrast: 1,
  bright: 1,
  particles: -1,
};

function numParam(
  params: URLSearchParams,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

export function parseTuning(): FluidTuning {
  if (typeof window === "undefined") return { ...DEFAULT_TUNING };
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      flow: numParam(params, "bgflow", 1, 0, 4),
      warp: numParam(params, "bgwarp", 1, 0, 3),
      scale: numParam(params, "bgscale", 1, 0.25, 4),
      mouse: numParam(params, "bgmouse", 1, 0, 3),
      filament: numParam(params, "bgfil", 1, 0.25, 3),
      trail: numParam(params, "bgtrail", 1, 0, 3),
      contrast: numParam(params, "bgcontrast", 1, 0, 3),
      bright: numParam(params, "bgbright", 1, 0, 2),
      particles: Math.floor(numParam(params, "bgparticles", -1, -1, 600)),
    };
  } catch {
    return { ...DEFAULT_TUNING };
  }
}
