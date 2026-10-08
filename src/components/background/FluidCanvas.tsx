"use client";

import { useEffect, useRef } from "react";

import {
  DEFAULT_TUNING,
  FLUID_PRESETS,
  QUALITY_DPR,
  type BackgroundQuality,
  type BackgroundTheme,
  type FluidTuning,
  type RouteProfile,
} from "./presets";

type FluidCanvasProps = {
  theme: BackgroundTheme;
  quality: BackgroundQuality;
  profile: RouteProfile;
  reduced: boolean;
  tuning?: FluidTuning;
  onReady: () => void;
  onFailure: () => void;
};

// Ambient owns its frame loop and input. It can keep flowing even when WebGL
// is unavailable, without intercepting any foreground links or controls.
export default function FluidCanvas(props: FluidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = useRef(props);
  const redraw = useRef<(() => void) | null>(null);
  useEffect(() => {
    settings.current = props;
    if (props.reduced) redraw.current?.();
  }, [props]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      settings.current.onFailure();
      return;
    }

    let width = 1;
    let height = 1;
    let frame = 0;
    let previous = 0;
    let time = 0;
    let visible = !document.hidden;
    let contextLost = false;
    let paused = document.documentElement.dataset.motion === "paused";
    const pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, active: false, strength: 0 };
    const ripple = { x: 0.5, y: 0.5, age: 10 };
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

    const draw = (delta: number) => {
      if (contextLost) return;
      const { theme, quality, profile, reduced, tuning: override } = settings.current;
      const tuning = { ...DEFAULT_TUNING, ...override };
      const palette = FLUID_PRESETS[theme];
      time += reduced ? 0 : delta * tuning.flow;
      ripple.age += delta;
      const ease = 1 - Math.exp(-12 * delta);
      pointer.x += (pointer.targetX - pointer.x) * ease;
      pointer.y += (pointer.targetY - pointer.y) * ease;
      pointer.strength += ((pointer.active && !reduced ? 1 : 0) - pointer.strength) * ease;

      context.globalAlpha = 1;
      context.fillStyle = palette.base;
      context.fillRect(0, 0, width, height);
      const brightness = tuning.bright * palette.brightness;
      const unit = Math.min(width, height);
      const glow = (x: number, y: number, radius: number, color: string, opacity: number) => {
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "transparent");
        context.globalAlpha = Math.min(1, opacity * brightness);
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
      };

      // Slow, independent currents keep the material alive with no input.
      glow(width * (0.68 + Math.sin(time * 0.23) * 0.15),
        height * (0.32 + Math.cos(time * 0.19) * 0.18),
        Math.max(width, height) * 0.65, palette.fluid, 0.085);
      glow(width * (0.23 + Math.cos(time * 0.17) * 0.13),
        height * (0.68 + Math.sin(time * 0.21) * 0.15),
        unit * 0.8, palette.accent2, 0.09);

      const mouseX = pointer.x * width;
      const mouseY = pointer.y * height;
      const radius = unit * 0.3;
      const influence = pointer.strength * tuning.mouse;
      // The old white mouse glow is gone: the site-wide cursor field
      // (CursorField, magnetic field lines) renders that halo instead. The
      // fluid field keeps using the pointer to bend the filaments below.

      const rows = quality === "low" ? 28 : quality === "medium" ? 40 : 48;
      const steps = quality === "low" ? 56 : 84;
      const scale = tuning.scale;
      const amplitude = tuning.warp * unit;
      const ink = context.createLinearGradient(0, 0, width, height);
      ink.addColorStop(0, palette.accent2);
      ink.addColorStop(0.38, palette.fluid);
      ink.addColorStop(0.72, palette.fluid);
      ink.addColorStop(1, palette.accent);
      context.strokeStyle = ink;
      context.lineCap = "round";
      context.lineJoin = "round";

      for (let row = 0; row < rows; row++) {
        const depth = row / (rows - 1);
        const baseY = (depth * 1.6 - 0.3) * height;
        context.beginPath();
        for (let step = 0; step <= steps; step++) {
          const u = step / steps;
          let x = (u * 1.2 - 0.1) * width;
          let y = baseY
            + Math.sin(u * 5.2 * scale + time * 0.44 + depth * 3.8) * amplitude * 0.18
            + Math.sin(u * 9.4 * scale - time * 0.32 + depth * 6.1) * amplitude * 0.055
            + Math.sin(u * 2.6 + time * 0.26) * amplitude * 0.09
            + (u - 0.5) * height * Math.sin(profile.flowAngle) * 0.18;
          const dx = x - mouseX;
          const dy = y - mouseY;
          const falloff = Math.exp(-(dx * dx + dy * dy) / (radius * radius));
          // Local curl bends the actual strands around the hovered position.
          // Its strength persists while hovering, including at zero flow speed.
          x += (-dy * 0.38 + (pointer.targetX - pointer.x) * width * 0.6) * falloff * influence;
          y += (dx * 0.38 + (pointer.targetY - pointer.y) * height * 0.6) * falloff * influence;
          if (!reduced && ripple.age < 1.6) {
            const distance = Math.hypot(x - ripple.x * width, y - ripple.y * height);
            y += Math.sin(distance / unit * 22 - ripple.age * 8)
              * Math.exp(-distance / (unit * 0.45)) * Math.exp(-ripple.age * 2.8) * unit * 0.025;
          }
          if (step === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        const highlight = Math.pow(0.5 + 0.5 * Math.sin(depth * 19 + time * 0.35), 3);
        const opacity = (0.035 + highlight * 0.14) * brightness * tuning.contrast * profile.intensity;
        context.globalAlpha = Math.min(0.6, opacity);
        context.lineWidth = (0.65 + highlight * 1.1) * tuning.filament;
        context.stroke();
        // Broad, faint strokes give the contours a soft silk body.
        if (row % 3 === 0) {
          context.globalAlpha = Math.min(0.12, opacity * 0.14);
          context.lineWidth = unit * 0.018;
          context.stroke();
        }
      }

      const particles = tuning.particles >= 0
        ? Math.min(120, tuning.particles)
        : quality === "low" ? 16 : 38;
      context.fillStyle = palette.particle;
      for (let index = 0; index < particles; index++) {
        const seed = index * 2.399963;
        const x = ((index * 0.618034 + Math.sin(time * 0.12 + seed) * 0.025) % 1 + 1) % 1;
        const y = ((index * 0.381966 + Math.cos(time * 0.1 + seed) * 0.035) % 1 + 1) % 1;
        context.globalAlpha = Math.min(0.5, (0.12 + 0.12 * Math.sin(seed + time * 0.3)) * brightness);
        context.beginPath();
        context.arc(x * width, y * height, index % 3 === 0 ? 1.1 : 0.65, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const tick = (now: number) => {
      frame = 0;
      if (!visible || paused || contextLost || settings.current.reduced) return;
      const interval = settings.current.quality === "low" ? 1000 / 30 : 1000 / 60;
      const elapsed = previous ? now - previous : interval;
      if (elapsed >= interval - 1) {
        draw(Math.min(elapsed / 1000, 0.064));
        previous = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!frame && visible && !paused && !contextLost && !settings.current.reduced) {
        previous = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const dpr = Math.min(window.devicePixelRatio || 1, QUALITY_DPR[settings.current.quality]);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(0);
    };
    const move = (event: PointerEvent) => {
      if (settings.current.reduced || paused || !finePointer.matches || event.pointerType === "touch") return;
      pointer.targetX = Math.max(0, Math.min(1, event.clientX / width));
      pointer.targetY = Math.max(0, Math.min(1, event.clientY / height));
      pointer.active = true;
    };
    const leave = () => { pointer.active = false; };
    const press = (event: PointerEvent) => {
      if (settings.current.reduced || paused) return;
      ripple.x = event.clientX / width;
      ripple.y = event.clientY / height;
      ripple.age = 0;
    };
    const syncMotion = () => {
      visible = !document.hidden;
      paused = document.documentElement.dataset.motion === "paused";
      if (!visible || paused) {
        cancelAnimationFrame(frame);
        frame = 0;
        leave();
      } else start();
    };
    const loseContext = () => {
      contextLost = true;
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const restore = () => {
      contextLost = false;
      resize();
      start();
    };
    redraw.current = () => draw(0);

    resize();
    settings.current.onReady();
    start();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", press, { passive: true });
    window.addEventListener("blur", leave);
    window.addEventListener("portfolio-motion", syncMotion);
    document.documentElement.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", syncMotion);
    canvas.addEventListener("contextlost", loseContext);
    canvas.addEventListener("contextrestored", restore);
    return () => {
      redraw.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("blur", leave);
      window.removeEventListener("portfolio-motion", syncMotion);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", syncMotion);
      canvas.removeEventListener("contextlost", loseContext);
      canvas.removeEventListener("contextrestored", restore);
    };
  }, [props.quality, props.reduced]);

  return <canvas ref={canvasRef} className="background-canvas" aria-hidden="true" />;
}
