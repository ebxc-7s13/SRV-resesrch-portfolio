"use client";

import { useSyncExternalStore } from "react";
import { ACCENT_COLORS, ACCENT_STORAGE_KEY, isAccentColor, type AccentColor } from "./accent-palette";

export const ACCENT_COLOR_EVENT = "portfolio-accent";
let current: AccentColor = "green";
let hydrated = false;
const listeners = new Set<() => void>();

function readStored(): AccentColor {
  try {
    const value = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isAccentColor(value)) return value;
  } catch { /* An in-memory choice still works when storage is unavailable. */ }
  return "green";
}

function apply(color: AccentColor) {
  current = color;
  hydrated = true;
  if (typeof document !== "undefined") document.documentElement.dataset.accent = color;
}

export function getAccentColor(): AccentColor {
  if (!hydrated && typeof window !== "undefined") apply(readStored());
  return current;
}

export function setAccentColor(color: AccentColor) {
  if (!isAccentColor(color)) return;
  apply(color);
  try { localStorage.setItem(ACCENT_STORAGE_KEY, color); } catch { /* Keep the live choice. */ }
  window.dispatchEvent(new Event(ACCENT_COLOR_EVENT));
}

export function cycleAccentColor() {
  setAccentColor(ACCENT_COLORS[(ACCENT_COLORS.indexOf(getAccentColor()) + 1) % ACCENT_COLORS.length]);
}

function notify() { listeners.forEach(callback => callback()); }
function syncStorage(event: StorageEvent) {
  if (event.key !== ACCENT_STORAGE_KEY && event.key !== null) return;
  // Ignore sessionStorage changes; localStorage can itself throw in privacy mode.
  try { if (event.storageArea && event.storageArea !== localStorage) return; } catch { return; }
  const next = readStored();
  if (next === getAccentColor()) return;
  apply(next);
  window.dispatchEvent(new Event(ACCENT_COLOR_EVENT));
}

export function subscribeAccentColor(callback: () => void) {
  getAccentColor();
  if (!listeners.size) {
    window.addEventListener(ACCENT_COLOR_EVENT, notify);
    window.addEventListener("storage", syncStorage);
  }
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
    if (!listeners.size) {
      window.removeEventListener(ACCENT_COLOR_EVENT, notify);
      window.removeEventListener("storage", syncStorage);
    }
  };
}

export function useAccentColor(): AccentColor {
  return useSyncExternalStore(subscribeAccentColor, getAccentColor, () => "green");
}
