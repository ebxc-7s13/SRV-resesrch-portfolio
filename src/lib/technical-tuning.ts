"use client";

import { useSyncExternalStore } from "react";
import type { TechnicalBackgroundMode } from "./background-mode";

export type TechnicalTuning = { brightness: number; speed: number; response: number };
export const DEFAULT_TECHNICAL_TUNING: TechnicalTuning = { brightness: 1, speed: 1, response: 1 };
const FLUX_DEFAULTS: TechnicalTuning = { brightness: 1, speed: 2, response: 2 };

export function getDefaultTechnicalTuning(mode: TechnicalBackgroundMode): TechnicalTuning {
  return mode === "flux" ? FLUX_DEFAULTS : DEFAULT_TECHNICAL_TUNING;
}

export const TECHNICAL_TUNING_LIMITS = {
  brightness: { min: 0.4, max: 1.6, step: 0.05 },
  speed: { min: 0, max: 2, step: 0.05 },
  response: { min: 0, max: 2, step: 0.05 },
} as const;

const EVENT_NAME = "portfolio-technical-tuning";
const current = new Map<TechnicalBackgroundMode, TechnicalTuning>();

function sanitize(mode: TechnicalBackgroundMode, raw: unknown): TechnicalTuning {
  const defaults = getDefaultTechnicalTuning(mode);
  const source = raw && typeof raw === "object" ? raw as Partial<TechnicalTuning> : {};
  const value = (key: keyof TechnicalTuning) => {
    const number = source[key];
    const { min, max } = TECHNICAL_TUNING_LIMITS[key];
    return typeof number === "number" && Number.isFinite(number)
      ? Math.min(max, Math.max(min, number)) : defaults[key];
  };
  return { brightness: value("brightness"), speed: value("speed"), response: value("response") };
}

export function getTechnicalTuning(mode: TechnicalBackgroundMode): TechnicalTuning {
  if (!current.has(mode)) {
    let tuning = { ...getDefaultTechnicalTuning(mode) };
    try {
      const saved = localStorage.getItem(`background-${mode}-tuning`);
      if (saved) tuning = sanitize(mode, JSON.parse(saved));
    } catch { /* storage unavailable or malformed */ }
    current.set(mode, tuning);
  }
  return current.get(mode)!;
}

export function setTechnicalTuning(mode: TechnicalBackgroundMode, patch: Partial<TechnicalTuning>) {
  const tuning = sanitize(mode, { ...getTechnicalTuning(mode), ...patch });
  current.set(mode, tuning);
  try { localStorage.setItem(`background-${mode}-tuning`, JSON.stringify(tuning)); } catch { /* in-memory settings still work */ }
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function resetTechnicalTuning(mode: TechnicalBackgroundMode) {
  setTechnicalTuning(mode, getDefaultTechnicalTuning(mode));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}

export function useTechnicalTuning(mode: TechnicalBackgroundMode) {
  return useSyncExternalStore(subscribe, () => getTechnicalTuning(mode), () => getDefaultTechnicalTuning(mode));
}
