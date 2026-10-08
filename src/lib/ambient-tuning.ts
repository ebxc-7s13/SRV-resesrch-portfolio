// Ambient background tuning — the ONLY place ambient speed/brightness/warp/
// scale multipliers live. Same useSyncExternalStore pattern as the other
// preference stores: SSR snapshot is the defaults, stored values hydrate
// post-mount. All defaults are 1 (neutral) so the shipped night look is
// unchanged until the user moves a slider.
"use client";

import { useSyncExternalStore } from "react";

export type AmbientTuning = {
  /** Flow-speed multiplier. */
  speed: number;
  /** Brightness multiplier. */
  brightness: number;
  /** Domain-warp multiplier. */
  warp: number;
  /** Field-scale multiplier. */
  scale: number;
};

export const DEFAULT_AMBIENT_TUNING: AmbientTuning = {
  speed: 1,
  brightness: 1,
  warp: 1,
  scale: 1,
};

export const AMBIENT_TUNING_LIMITS = {
  speed: { min: 0, max: 3, step: 0.1 },
  brightness: { min: 0.4, max: 2, step: 0.05 },
  warp: { min: 0, max: 3, step: 0.05 },
  scale: { min: 0.25, max: 2.5, step: 0.05 },
} as const;

const STORAGE_KEY = "ambient-tuning";
const EVENT_NAME = "portfolio-ambient-tuning";

let current: AmbientTuning = { ...DEFAULT_AMBIENT_TUNING };
let hydrated = false;

function clamp(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function sanitize(raw: unknown): AmbientTuning {
  const source = (raw ?? {}) as Partial<AmbientTuning>;
  return {
    speed: clamp(
      Number(source.speed),
      AMBIENT_TUNING_LIMITS.speed.min,
      AMBIENT_TUNING_LIMITS.speed.max,
      DEFAULT_AMBIENT_TUNING.speed,
    ),
    brightness: clamp(
      Number(source.brightness),
      AMBIENT_TUNING_LIMITS.brightness.min,
      AMBIENT_TUNING_LIMITS.brightness.max,
      DEFAULT_AMBIENT_TUNING.brightness,
    ),
    warp: clamp(
      Number(source.warp),
      AMBIENT_TUNING_LIMITS.warp.min,
      AMBIENT_TUNING_LIMITS.warp.max,
      DEFAULT_AMBIENT_TUNING.warp,
    ),
    scale: clamp(
      Number(source.scale),
      AMBIENT_TUNING_LIMITS.scale.min,
      AMBIENT_TUNING_LIMITS.scale.max,
      DEFAULT_AMBIENT_TUNING.scale,
    ),
  };
}

function readStored(): AmbientTuning {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AMBIENT_TUNING };
    return sanitize(JSON.parse(raw));
  } catch {
    /* storage unavailable or corrupt — fall back to defaults */
  }
  return { ...DEFAULT_AMBIENT_TUNING };
}

function emit() {
  try {
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    /* non-DOM environment — subscribers simply never fire */
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable — in-memory tuning still applies */
  }
}

export function getAmbientTuning(): AmbientTuning {
  if (!hydrated && typeof window !== "undefined") {
    current = readStored();
    hydrated = true;
  }
  return current;
}

export function setAmbientTuning(patch: Partial<AmbientTuning>) {
  current = sanitize({ ...current, ...patch });
  persist();
  emit();
}

export function resetAmbientTuning() {
  current = { ...DEFAULT_AMBIENT_TUNING };
  persist();
  emit();
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}

function serverSnapshot(): AmbientTuning {
  return DEFAULT_AMBIENT_TUNING;
}

export function useAmbientTuning(): AmbientTuning {
  return useSyncExternalStore(subscribe, getAmbientTuning, serverSnapshot);
}
