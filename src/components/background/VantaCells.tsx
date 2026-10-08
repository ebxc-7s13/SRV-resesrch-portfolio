"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { useBackgroundMode } from "@/lib/background-mode";
import {
  DEFAULT_CELLS_TUNING,
  useCellsTuning,
} from "@/lib/cells-tuning";
import type {
  VantaCellsOptions,
  VantaEffect,
} from "vanta/dist/vanta.cells.min";

// Restrained microscopic palette on the portfolio night substrate.
// Lime cell voice, deep-cyan second voice — no demo neon.
const CELLS_OPTIONS: Omit<VantaCellsOptions, "el" | "THREE"> = {
  mouseControls: true,
  touchControls: true,
  gyroControls: false,
  minHeight: 200.0,
  minWidth: 200.0,
  scale: 1.0,
  // Lightweight mobile raster: the effect's own low-res fallback.
  scaleMobile: 3.0,
  color1: 0xb7ff4a,
  color2: 0x7de7ff,
  backgroundColor: 0x070809,
  size: DEFAULT_CELLS_TUNING.size,
  speed: DEFAULT_CELLS_TUNING.speed,
};

// Under prefers-reduced-motion the user's choice still wins: the layer mounts
// nearly still (gentle drift) instead of being refused outright.
const CELLS_OPTIONS_REDUCED: Omit<VantaCellsOptions, "el" | "THREE"> = {
  ...CELLS_OPTIONS,
  speed: 0.08,
  mouseControls: false,
  touchControls: false,
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return reduced;
}

// Keep the existing slider timing while updating shader options in place.
// Brightness is a CSS filter on the host and applies instantly.
function useDebouncedValue(value: number, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Optional Vanta CELLS site background. Centrally mounted once by
 * PortfolioFrame (never per-route, never inside the Lab). Owns exactly one
 * WebGL context while active: init once per activation, destroy on mode
 * change / unmount / context loss. PortfolioFrame owns the selected mode's
 * root CSS marker for all five backgrounds.
 */
export default function VantaCellsLayer() {
  const mode = useBackgroundMode();
  const hostRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<VantaEffect | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const reduced = usePrefersReducedMotion();
  const tuning = useCellsTuning();
  // Shader options update in place; brightness is CSS-only.
  const liveSpeed = useDebouncedValue(tuning.speed, 140);
  const liveSize = useDebouncedValue(tuning.size, 140);
  const liveOptions = useRef({ speed: liveSpeed, size: liveSize });

  const enabled = mode === "cells" && !failed;

  useEffect(() => {
    liveOptions.current = {
      speed: reduced ? CELLS_OPTIONS_REDUCED.speed! : liveSpeed,
      size: liveSize,
    };
    effectRef.current?.setOptions(liveOptions.current);
  }, [reduced, liveSpeed, liveSize]);

  useEffect(() => {
    if (!enabled) return;
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let effect: VantaEffect | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let onLost: ((event: Event) => void) | null = null;

    void (async () => {
      try {
        const mod = await import("vanta/dist/vanta.cells.min");
        const CELLS = (
          mod as { default?: unknown } & Record<string, unknown>
        ).default;
        if (cancelled || !host.isConnected || typeof CELLS !== "function")
          return;
        effect = (CELLS as (o: VantaCellsOptions) => VantaEffect)({
          ...(reduced ? CELLS_OPTIONS_REDUCED : CELLS_OPTIONS),
          // Live tuning: reduced-motion keeps its gentle drift speed, but
          // user size/brightness choices still apply.
          ...liveOptions.current,
          el: host,
          // Reuse the project's single Three.js instance.
          THREE,
        });
        if (cancelled) {
          try {
            effect.destroy();
          } catch {
            /* already torn down */
          }
          return;
        }
        effectRef.current = effect;
        canvas = host.querySelector("canvas");
        if (canvas) {
          onLost = (event) => {
            event.preventDefault();
            setFailed(true);
          };
          canvas.addEventListener("webglcontextlost", onLost);
        }
        setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      const live = effectRef.current ?? effect;
      effectRef.current = null;
      if (canvas && onLost) canvas.removeEventListener("webglcontextlost", onLost);
      try {
        live?.destroy();
      } catch {
        /* already torn down */
      }
      setReady(false);
    };
  }, [enabled, reduced]);

  if (!enabled) return null;

  return (
    <div
      className="vanta-cells-layer"
      aria-hidden="true"
      style={{
        opacity: ready ? 1 : 0,
        transition: "opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        ref={hostRef}
        className="vanta-cells-host"
        style={{ filter: `brightness(${tuning.brightness})` }}
      />
      <div className="vanta-cells-shade" />
    </div>
  );
}
