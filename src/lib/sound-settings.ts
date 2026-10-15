// Sound settings — the ONLY place sound preferences live. Same external-store
// pattern as background-mode.ts: components read via useSoundSettings(), the
// engine subscribes with subscribeSoundSettings(), writers call
// setSoundSettings(). The server snapshot is always the defaults; the stored
// preference hydrates post-mount. Persisted per browser in localStorage.
"use client";

import { useSyncExternalStore } from "react";
import {
  SCENE_FAMILIES,
  SCENE_PROFILES,
  SOUND_PRESETS,
  UI_CATALOG,
  type ProfileCategory,
  type SceneFamily,
} from "./sound-profiles";

export const SOUND_SETTINGS_KEY = "sound-settings";
export const SOUND_SETTINGS_VERSION = 1;
const EVENT_NAME = "portfolio-sound";

export type SoundSettings = {
  version: typeof SOUND_SETTINGS_VERSION;
  /** Master switch for every effect and ambience. */
  enabled: boolean;
  /** Master volume, 0..1. */
  volume: number;
  hover: boolean;
  nav: string;
  button: string;
  footer: string;
  scenes: Record<SceneFamily, string>;
  transitions: boolean;
  /** Optional ambience — always off until the visitor turns it on. */
  ambient: boolean;
  ambientVolume: number;
  /** Open / close / select cues of the sound panel itself. */
  panelSounds: boolean;
};

export function defaultSoundSettings(): SoundSettings {
  const preset = SOUND_PRESETS[0];
  return {
    version: SOUND_SETTINGS_VERSION,
    enabled: true,
    volume: 0.45,
    hover: true,
    nav: preset.nav,
    button: preset.button,
    footer: preset.footer,
    scenes: { ...preset.scenes },
    transitions: true,
    ambient: false,
    ambientVolume: 0.35,
    panelSounds: true,
  };
}

const DEFAULTS = defaultSoundSettings();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function unit(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function profile(category: ProfileCategory, value: unknown, fallback: string) {
  return typeof value === "string" && UI_CATALOG[category].some((p) => p.id === value)
    ? value
    : fallback;
}

/**
 * Validate anything (stored JSON, merged patches) into complete settings.
 * Invalid fields fall back to `fallback` — the defaults for stored data, the
 * current settings for patches — so one bad value never resets the rest.
 */
export function sanitizeSoundSettings(raw: unknown, fallback: SoundSettings = defaultSoundSettings()): SoundSettings {
  const d = fallback;
  if (!isObject(raw) || raw.version !== SOUND_SETTINGS_VERSION) return defaultSoundSettings();
  const scenes = isObject(raw.scenes) ? raw.scenes : {};
  return {
    version: SOUND_SETTINGS_VERSION,
    enabled: bool(raw.enabled, d.enabled),
    volume: unit(raw.volume, d.volume),
    hover: bool(raw.hover, d.hover),
    nav: profile("nav", raw.nav, d.nav),
    button: profile("button", raw.button, d.button),
    footer: profile("footer", raw.footer, d.footer),
    scenes: Object.fromEntries(
      SCENE_FAMILIES.map((family) => {
        const value = scenes[family];
        const valid =
          typeof value === "string" &&
          SCENE_PROFILES[family].some((p) => p.id === value);
        return [family, valid ? value : d.scenes[family]];
      }),
    ) as Record<SceneFamily, string>,
    transitions: bool(raw.transitions, d.transitions),
    ambient: bool(raw.ambient, d.ambient),
    ambientVolume: unit(raw.ambientVolume, d.ambientVolume),
    panelSounds: bool(raw.panelSounds, d.panelSounds),
  };
}

let current: SoundSettings = DEFAULTS;
let hydrated = false;
const listeners = new Set<(settings: SoundSettings) => void>();

function readStored(): SoundSettings {
  try {
    const value = localStorage.getItem(SOUND_SETTINGS_KEY);
    if (value) return sanitizeSoundSettings(JSON.parse(value));
  } catch {
    /* storage unavailable or corrupt — fall back to defaults */
  }
  return defaultSoundSettings();
}

export function getSoundSettings(): SoundSettings {
  if (!hydrated && typeof window !== "undefined") {
    current = readStored();
    hydrated = true;
  }
  return current;
}

function commit(next: SoundSettings) {
  current = next;
  hydrated = true;
  try {
    localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — in-memory settings still apply this visit */
  }
  listeners.forEach((fn) => fn(next));
  try {
    window.dispatchEvent(new Event(EVENT_NAME));
  } catch {
    /* non-DOM environment */
  }
}

export type SoundSettingsPatch = Partial<Omit<SoundSettings, "version" | "scenes">> & {
  scenes?: Partial<Record<SceneFamily, string>>;
};

/** Merge a patch; invalid values are rejected field by field. */
export function setSoundSettings(patch: SoundSettingsPatch) {
  const base = getSoundSettings();
  commit(
    sanitizeSoundSettings(
      {
        ...base,
        ...patch,
        scenes: { ...base.scenes, ...patch.scenes },
      },
      base,
    ),
  );
}

export function setSceneProfile(family: SceneFamily, id: string) {
  setSoundSettings({ scenes: { [family]: id } });
}

/** A preset changes the four profile categories only; mix settings stay. */
export function applySoundPreset(id: string) {
  const preset = SOUND_PRESETS.find((p) => p.id === id);
  if (!preset) return;
  setSoundSettings({
    nav: preset.nav,
    button: preset.button,
    footer: preset.footer,
    scenes: { ...preset.scenes },
  });
}

export function resetSoundSettings() {
  commit(defaultSoundSettings());
}

export function subscribeSoundSettings(listener: (settings: SoundSettings) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let storageBound = false;

function subscribe(callback: () => void) {
  // Another tab changed the stored settings: adopt them here too. Bound once
  // for the page lifetime, however many components subscribe.
  if (!storageBound) {
    storageBound = true;
    window.addEventListener("storage", (event) => {
      if (event.key !== SOUND_SETTINGS_KEY) return;
      current = readStored();
      hydrated = true;
      listeners.forEach((fn) => fn(current));
      window.dispatchEvent(new Event(EVENT_NAME));
    });
  }
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}

function serverSnapshot(): SoundSettings {
  return DEFAULTS;
}

export function useSoundSettings(): SoundSettings {
  return useSyncExternalStore(subscribe, getSoundSettings, serverSnapshot);
}
