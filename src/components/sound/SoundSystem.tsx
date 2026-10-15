"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  getBackgroundMode,
  subscribeBackgroundMode,
  useBackgroundMode,
  type BackgroundMode,
} from "@/lib/background-mode";
import {
  installSoundEngine,
  playSceneTransition,
  setAmbientScene,
} from "@/lib/sound-engine";
import { installSoundInteractions } from "@/lib/sound-interactions";
import type { SceneFamily } from "@/lib/sound-profiles";
import SoundControl from "./SoundControl";

/** The background family actually on screen for a route, if any. */
export function visibleScene(path: string, mode: BackgroundMode): SceneFamily | null {
  if (path === "/play") return "liquid";
  if (path.startsWith("/lab") || path.startsWith("/admin")) return null;
  return mode;
}

/**
 * Mounts the site's audio once, for the lifetime of the portfolio frame:
 * the shared engine, the delegated interaction listeners, the scene /
 * ambience bindings and the floating sound control. Nothing here plays on
 * mount or hydration — only real input and real scene changes make sound.
 */
export default function SoundSystem() {
  const path = usePathname();
  const mode = useBackgroundMode();
  const scene = visibleScene(path, mode);
  const pathRef = useRef(path);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  useEffect(() => installSoundEngine(), []);
  useEffect(() => installSoundInteractions(), []);

  useEffect(() => {
    setAmbientScene(scene);
  }, [scene]);
  useEffect(() => () => setAmbientScene(null), []);

  // Scene transitions follow the background store's own change event, which
  // only fires from setBackgroundMode() — never from hydration or rerenders.
  useEffect(() => {
    let previous = getBackgroundMode();
    return subscribeBackgroundMode(() => {
      const next = getBackgroundMode();
      if (next === previous) return;
      previous = next;
      if (visibleScene(pathRef.current, next)) playSceneTransition(next, { delay: 0.06 });
    });
  }, []);

  if (path.startsWith("/admin")) return null;
  return <SoundControl activeScene={scene} />;
}
