// Cells background tuning — the ONLY place cells brightness/speed/size live.
// Same useSyncExternalStore pattern as background-mode: SSR snapshot is the
// defaults so server and first client render match; stored values hydrate
// post-mount. Writers call setCellsTuning() / resetCellsTuning().
"use client";

import { useSyncExternalStore } from "react";

export type CellsTuning = {
  /** CSS brightness multiplier applied to the cells canvas. */
  brightness: number;
  /** Vanta cells animation speed. */
  speed: number;
  /** Vanta cells cell size. */
  size: number;
};

// Fixed defaults: the current shipped look (neon lime/cyan, brightness
// 0.85, speed 1.8, size 2.8). The popup's Reset button restores exactly
// these — do not change them.
export const DEFAULT_CELLS_TUNING: CellsTuning = {
  brightness: 0.85,
  speed: 1.8,
  size: 2.8,
};

export const CELLS_TUNING_LIMITS = {
  brightness: { min: 0.4, max: 2, step: 0.05 },
  speed: { min: 0, max: 3, step: 0.1 },
  size: { min: 0.8, max: 4, step: 0.1 },
} as const;

const STORAGE_KEY = "cells-tuning";
const EVENT_NAME = "portfolio-cells-tuning";

let current: CellsTuning = { ...DEFAULT_CELLS_TUNING };
let hydrated = false;

function clamp(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function sanitize(raw: unknown): CellsTuning {
  const source = (raw ?? {}) as Partial<CellsTuning>;
  return {
    brightness: clamp(
      Number(source.brightness),
      CELLS_TUNING_LIMITS.brightness.min,
      CELLS_TUNING_LIMITS.brightness.max,
      DEFAULT_CELLS_TUNING.brightness,
    ),
    speed: clamp(
      Number(source.speed),
      CELLS_TUNING_LIMITS.speed.min,
      CELLS_TUNING_LIMITS.speed.max,
      DEFAULT_CELLS_TUNING.speed,
    ),
    size: clamp(
      Number(source.size),
      CELLS_TUNING_LIMITS.size.min,
      CELLS_TUNING_LIMITS.size.max,
      DEFAULT_CELLS_TUNING.size,
    ),
  };
}

function readStored(): CellsTuning {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CELLS_TUNING };
    return sanitize(JSON.parse(raw));
  } catch {
    /* storage unavailable or corrupt — fall back to defaults */
  }
  return { ...DEFAULT_CELLS_TUNING };
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

export function getCellsTuning(): CellsTuning {
  if (!hydrated && typeof window !== "undefined") {
    current = readStored();
    hydrated = true;
  }
  return current;
}

export function setCellsTuning(patch: Partial<CellsTuning>) {
  current = sanitize({ ...current, ...patch });
  persist();
  emit();
}

export function resetCellsTuning() {
  current = { ...DEFAULT_CELLS_TUNING };
  persist();
  emit();
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}

function serverSnapshot(): CellsTuning {
  return DEFAULT_CELLS_TUNING;
}

export function useCellsTuning(): CellsTuning {
  return useSyncExternalStore(subscribe, getCellsTuning, serverSnapshot);
}
