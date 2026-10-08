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
    const wake = { x: 0.5, y: 0.5 };
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
      const wakeEase = 1 - Math.exp(-4 * delta);
      wake.x += (pointer.x - wake.x) * wakeEase;
      wake.y += (pointer.y - wake.y) * wakeEase;

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
        // Clip local blooms to their bounds instead of shading the full canvas.
        const left = Math.max(0, x - radius), top = Math.max(0, y - radius);
        context.fillRect(left, top, Math.max(0, Math.min(width, x + radius) - left),
          Math.max(0, Math.min(height, y + radius) - top));
      };

      // Slow, independent currents keep the material alive with no input.
      glow(width * (0.68 + Math.sin(time * 0.23) * 0.15),
        height * (0.32 + Math.cos(time * 0.19) * 0.18),
        Math.max(width, height) * 0.65, palette.fluid, 0.24);
      glow(width * (0.23 + Math.cos(time * 0.17) * 0.13),
        height * (0.68 + Math.sin(time * 0.21) * 0.15),
        unit * 0.95, palette.accent2, 0.28);
      glow(width * (0.86 + Math.sin(time * 0.13) * 0.06),
        height * (0.8 + Math.cos(time * 0.16) * 0.1),
        unit * 0.65, palette.accent, 0.075);

      const mouseX = pointer.x * width;
      const mouseY = pointer.y * height;
      const radius = unit * 0.34;
      const influence = pointer.strength * tuning.mouse;
      // Color belongs to the material beneath the pointer. A slower violet
      // wake follows the cyan core, while the strands curl around both.
      if (influence > 0.005) {
        glow(wake.x * width, wake.y * height, unit * 0.24, palette.accent2, influence * 0.16);
        glow(mouseX, mouseY, unit * 0.17, palette.fluid, influence * 0.2);
      }
      if (!reduced && ripple.age < 1.6) {
        glow(ripple.x * width, ripple.y * height, unit * (0.1 + ripple.age * 0.28),
          palette.accent2, Math.exp(-ripple.age * 3) * 0.2);
      }

      const rows = quality === "low" ? 28 : quality === "medium" ? 40 : 48;
      const steps = quality === "low" ? 56 : 84;
      const scale = tuning.scale;
      const amplitude = tuning.warp * unit;
      const ink = context.createLinearGradient(0, 0, width, height);
      ink.addColorStop(0, palette.accent2);
      ink.addColorStop(0.28, palette.accent2);
      ink.addColorStop(0.58, palette.fluid);
      ink.addColorStop(0.82, palette.fluid);
      ink.addColorStop(1, palette.accent);
      context.strokeStyle = ink;
      context.lineCap = "round";
      context.lineJoin = "round";

      for (let row = 0; row < rows; row++) {
        const depth = row / (rows - 1);
        const baseY = (depth * 1.6 - 0.3) * height;
        let proximity = 0;
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
          proximity = Math.max(proximity, falloff * influence);
          // Local curl bends the actual strands around the hovered position.
          // Its strength persists while hovering, including at zero flow speed.
          x += (-dy * 0.68 + (pointer.targetX - wake.x) * width * 0.42) * falloff * influence;
          y += (dx * 0.68 + (pointer.targetY - wake.y) * height * 0.42) * falloff * influence;
          if (!reduced && ripple.age < 1.6) {
            const distance = Math.hypot(x - ripple.x * width, y - ripple.y * height);
            y += Math.sin(distance / unit * 22 - ripple.age * 8)
              * Math.exp(-distance / (unit * 0.45)) * Math.exp(-ripple.age * 2.8) * unit * 0.035;
          }
          if (step === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        const highlight = Math.pow(0.5 + 0.5 * Math.sin(depth * 19 + time * 0.35), 3);
        const opacity = (0.055 + highlight * 0.22 + proximity * 0.12) * brightness * tuning.contrast * profile.intensity;
        context.globalAlpha = Math.min(0.5, opacity);
        context.lineWidth = (0.75 + highlight * 1.3 + proximity * 0.6) * tuning.filament;
        context.stroke();
        // Broad, faint strokes give the contours a soft silk body.
        if (row % 3 === 0) {
          context.globalAlpha = Math.min(0.12, opacity * 0.22);
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
      if (settings.current.reduced || paused || !visible || !finePointer.matches || event.pointerType === "touch") return;
      pointer.targetX = Math.max(0, Math.min(1, event.clientX / width));
      pointer.targetY = Math.max(0, Math.min(1, event.clientY / height));
      if (!pointer.active) {
        pointer.x = wake.x = pointer.targetX;
        pointer.y = wake.y = pointer.targetY;
      }
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
