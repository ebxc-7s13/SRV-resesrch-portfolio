"use client";

import { useEffect, useRef, useState } from "react";

import { useBackgroundMode } from "@/lib/background-mode";
import { getLiquidTuning, useLiquidTuning } from "@/lib/liquid-tuning";
import type { LiquidApp } from "threejs-components/build/backgrounds/liquid1.min.js";

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

/**
 * Optional liquid-mouse site background (third mode: Ambient / Cells /
 * Liquid). Centrally mounted once by PortfolioFrame (never per-route, never
 * inside the Lab). Owns exactly one WebGL context while active: init once per
 * activation, destroy on mode change / unmount / context loss. The library
 * tracks the mouse via document.body listeners, so the fixed canvas stays
 * pointer-transparent and never blocks clicks, scroll or the Lab.
 *
 * Implementation: the installed threejs-components package
 * (build/backgrounds/liquid1.min.js) — no CDN imports. The texture is the
 * local /liquid.webp.
 */
export default function LiquidMouseLayer() {
  const mode = useBackgroundMode();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<LiquidApp | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const reduced = usePrefersReducedMotion();
  const tuning = useLiquidTuning();

  const enabled = mode === "liquid" && !failed;

  // Water parameters apply live to the running instance — no rebuild, no
  // WebGL context churn while dragging sliders. Brightness stays CSS-only
  // (style filter on the host, like the cells layer).
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    try {
      app.liquidPlane.material.metalness = tuning.metalness;
      app.liquidPlane.material.roughness = tuning.roughness;
      app.liquidPlane.uniforms.displacementScale.value = tuning.displacement;
      app.setRain(tuning.rain);
    } catch {
      /* instance torn down mid-update */
    }
  }, [tuning]);

  useEffect(() => {
    if (!enabled || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    // Local handle: whatever exists (even mid-init) is disposed exactly once.
    let app: LiquidApp | null = null;

    const onLost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", onLost);

    const teardown = () => {
      const live = appRef.current ?? app;
      appRef.current = null;
      app = null;
      canvas.removeEventListener("webglcontextlost", onLost);
      try {
        live?.dispose();
      } catch {
        /* already torn down */
      }
    };

    void (async () => {
      try {
        // Reference behavior:
        //   const app = LiquidBackground(canvas)
        //   app.loadImage("/liquid.webp")
        //   app.liquidPlane.material.metalness = 0.75
        //   app.liquidPlane.material.roughness = 0.25
        //   app.liquidPlane.uniforms.displacementScale.value = 5
        //   app.setRain(false)
        // (values come from the liquid-tuning store, whose defaults equal
        // the reference constants)
        const mod = await import(
          "threejs-components/build/backgrounds/liquid1.min.js"
        );
        const create = mod.default;
        if (cancelled || !canvas.isConnected || typeof create !== "function")
          return;
        app = create(canvas);
        if (cancelled) {
          teardown();
          return;
        }
        const live = getLiquidTuning();
        app.liquidPlane.material.metalness = live.metalness;
        app.liquidPlane.material.roughness = live.roughness;
        app.liquidPlane.uniforms.displacementScale.value = live.displacement;
        app.setRain(live.rain);
        await app.loadImage("/liquid.webp");
        if (cancelled) {
          teardown();
          return;
        }
        appRef.current = app;
        setReady(true);
      } catch {
        if (cancelled) return;
        teardown();
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      teardown();
      setReady(false);
    };
  }, [enabled, reduced]);

  if (!enabled) return null;

  // Reduced motion / WebGL failure: static gradient, no canvas, no loop.
  if (reduced || failed) {
    return (
      <div className="liquid-layer" aria-hidden="true">
        <div className="liquid-fallback" />
        <div className="liquid-shade" />
      </div>
    );
  }

  return (
    <div
      className="liquid-layer"
      aria-hidden="true"
      style={{
        opacity: ready ? 1 : 0,
        transition: "opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        className="liquid-host"
        style={{ filter: `brightness(${tuning.brightness})` }}
      >
        <canvas ref={canvasRef} className="liquid-canvas" />
      </div>
      <div className="liquid-shade" />
    </div>
  );
}
