// Background mode state — the ONLY place the ambient/cells preference lives.
// Foreground code reads via useBackgroundMode(); writers call
// setBackgroundMode(). SSR snapshot is always "cells" so server and first
// client render match; the stored preference hydrates post-mount.
"use client";

import { useSyncExternalStore } from "react";

export type BackgroundMode = "ambient" | "cells" | "liquid";

const STORAGE_KEY = "background-mode";
const EVENT_NAME = "portfolio-background";

let current: BackgroundMode = "cells";
let hydrated = false;

function readStored(): BackgroundMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "cells" || value === "liquid" || value === "ambient")
      return value;
  } catch {
    /* storage unavailable — fall back to default */
  }
  return "cells";
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
  current = mode;
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
