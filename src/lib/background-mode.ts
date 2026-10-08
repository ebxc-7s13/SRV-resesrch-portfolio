// Background mode state — the ONLY place the environment preference lives.
// Foreground code reads via useBackgroundMode(); writers call
// setBackgroundMode(). SSR snapshot is always "cells" so server and first
// client render match; the stored preference hydrates post-mount.
"use client";

import { useSyncExternalStore } from "react";
import { resetLiquidTuning } from "./liquid-tuning";

export const BACKGROUND_MODES = ["cells", "liquid", "flux", "prism", "membrane"] as const;
export type BackgroundMode = (typeof BACKGROUND_MODES)[number];
export type TechnicalBackgroundMode = Exclude<BackgroundMode, "cells" | "liquid">;

export function isTechnicalBackground(mode: BackgroundMode): mode is TechnicalBackgroundMode {
  return mode === "flux" || mode === "prism" || mode === "membrane";
}

const STORAGE_KEY = "background-mode";
const EVENT_NAME = "portfolio-background";

let current: BackgroundMode = "cells";
let hydrated = false;

function readStored(): BackgroundMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (BACKGROUND_MODES.includes(value as BackgroundMode))
      return value as BackgroundMode;
  } catch {
    /* storage unavailable — fall back to default */
  }
  return typeof window !== "undefined" &&
    window.matchMedia("(max-width: 768px), (pointer: coarse)").matches
    ? "liquid"
    : "cells";
}

function emit() {
  try {
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    /* non-DOM environment — subscribers simply never fire */
  }
}

export function getBackgroundMode(): BackgroundMode {
  if (!hydrated && typeof window !== "undefined") {
    current = readStored();
    hydrated = true;
  }
  return current;
}

export function setBackgroundMode(mode: BackgroundMode) {
  // Apply the chosen reference look before the Liquid renderer mounts.
  if (mode === "liquid") resetLiquidTuning();
  current = mode;
  hydrated = true;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage unavailable — in-memory preference still applies */
  }
  emit();
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}

function serverSnapshot(): BackgroundMode {
  return "cells";
}

export function useBackgroundMode(): BackgroundMode {
  return useSyncExternalStore(subscribe, getBackgroundMode, serverSnapshot);
}
