// Liquid background tuning — the ONLY place liquid water parameters live.
// Same useSyncExternalStore pattern as cells-tuning: SSR snapshot is the
// defaults so server and first client render match; stored values hydrate
// post-mount. Writers call setLiquidTuning() / resetLiquidTuning().
"use client";

import { useSyncExternalStore } from "react";

export type LiquidTuning = {
  /** CSS brightness multiplier applied to the liquid canvas. */
  brightness: number;
  /** Ripple depth (liquid displacementScale). */
  displacement: number;
  /** Liquid surface metalness. */
  metalness: number;
  /** Liquid surface roughness. */
  roughness: number;
  /** Ambient rain drops (extra ripple disturbance). */
  rain: boolean;
};

// Fixed defaults: the shipped reference look (metalness 0.55 / roughness
// 0.10 / displacement 5.5 / brightness 1.85, rain off). The popup's Reset
// button restores exactly these.
export const DEFAULT_LIQUID_TUNING: LiquidTuning = {
  brightness: 1.85,
  displacement: 5.5,
  metalness: 0.55,
  roughness: 0.1,
  rain: false,
};

export const LIQUID_TUNING_LIMITS = {
  brightness: { min: 0.4, max: 2, step: 0.05 },
  displacement: { min: 1, max: 10, step: 0.5 },
  metalness: { min: 0, max: 1, step: 0.05 },
  roughness: { min: 0, max: 1, step: 0.05 },
} as const;

const STORAGE_KEY = "liquid-tuning";
const EVENT_NAME = "portfolio-liquid-tuning";

let current: LiquidTuning = { ...DEFAULT_LIQUID_TUNING };
let hydrated = false;

function clamp(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function sanitize(raw: unknown): LiquidTuning {
  const source = (raw ?? {}) as Partial<LiquidTuning>;
  return {
    brightness: clamp(
      Number(source.brightness),
      LIQUID_TUNING_LIMITS.brightness.min,
      LIQUID_TUNING_LIMITS.brightness.max,
      DEFAULT_LIQUID_TUNING.brightness,
    ),
    displacement: clamp(
      Number(source.displacement),
      LIQUID_TUNING_LIMITS.displacement.min,
      LIQUID_TUNING_LIMITS.displacement.max,
      DEFAULT_LIQUID_TUNING.displacement,
    ),
    metalness: clamp(
      Number(source.metalness),
      LIQUID_TUNING_LIMITS.metalness.min,
      LIQUID_TUNING_LIMITS.metalness.max,
      DEFAULT_LIQUID_TUNING.metalness,
    ),
    roughness: clamp(
      Number(source.roughness),
      LIQUID_TUNING_LIMITS.roughness.min,
      LIQUID_TUNING_LIMITS.roughness.max,
      DEFAULT_LIQUID_TUNING.roughness,
    ),
    rain: source.rain === true,
  };
}

function readStored(): LiquidTuning {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LIQUID_TUNING };
    return sanitize(JSON.parse(raw));
  } catch {
    /* storage unavailable or corrupt — fall back to defaults */
  }
  return { ...DEFAULT_LIQUID_TUNING };
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

export function getLiquidTuning(): LiquidTuning {
  if (!hydrated && typeof window !== "undefined") {
    current = readStored();
    hydrated = true;
  }
  return current;
}

export function setLiquidTuning(patch: Partial<LiquidTuning>) {
  current = sanitize({ ...current, ...patch });
  persist();
  emit();
}

export function resetLiquidTuning() {
  current = { ...DEFAULT_LIQUID_TUNING };
  persist();
  emit();
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}

function serverSnapshot(): LiquidTuning {
  return DEFAULT_LIQUID_TUNING;
}

export function useLiquidTuning(): LiquidTuning {
  return useSyncExternalStore(subscribe, getLiquidTuning, serverSnapshot);
}
