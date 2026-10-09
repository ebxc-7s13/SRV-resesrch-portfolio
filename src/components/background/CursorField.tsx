"use client";

import { getAccentColor, subscribeAccentColor } from "@/lib/accent-color";
import { ACCENT_PALETTES } from "@/lib/accent-palette";

import { useEffect, useRef } from "react";
import { interaction, subscribeInteraction } from "@/lib/interaction";

/**
 * Magnetic field-line cursor field — the site-wide cursor treatment.
 *
 * A grid of short neon line segments covers the viewport. Each segment
 * rotates to point at the cursor and brightens with proximity, so the field
 * reads as iron filings aligning to a magnet — an instrument voice that
 * matches the site's telemetry language. While the pointer moves, the whole
 * local field tilts toward the motion direction and then relaxes back to the
 * radial compass, so a swipe leaves a current behind it.
 *
 * Perf contract (same as the field it replaces):
 * - One shared input source: reads the shared `interaction` store via
 *   `subscribeInteraction` — no pointer listeners of its own.
 * - Only segments inside the influence disc are touched per frame; the rAF
 *   loop stops whenever the field has settled; DPR is capped.
 * - Gates: fine pointer + mouse only, inert under prefers-reduced-motion,
 *   cancelled on hidden tab / paused motion, skipped on saveData.
 */

const CELL = 26; // px between segment centres
const RADIUS = 200; // px of influence around the cursor
const CORE = 24; // px inside which segments reach full length/opacity
const MAX_LENGTH = 11; // px of the longest segment
const MIN_LENGTH = 2.5; // px floor so the rim stays visible as short ticks
const BASE_ALPHA = 0.5; // peak opacity at the core
const SWAY = 0.55; // radians a segment can lean toward motion at full speed
const DPR_CAP = 1.5;

export default function CursorField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = useRef({ reduced: false, lowPower: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 1;
    let height = 1;
    let frame = 0;
    let previous = 0;
    let active = false; // pointer currently over the page
    let visible = !document.hidden;
    let paused = document.documentElement.dataset.motion === "paused";
    let accent = ACCENT_PALETTES[getAccentColor()].text.join(" ");
    // Damped motion vector: the last frame's cursor velocity, eased, drives
    // the whole field's lean. Decays to zero when the pointer rests.
    let vx = 0;
    let vy = 0;
    // Seed from the shared store so a cursor already over the page on mount
    // (route swap) starts from the right place instead of the top-left.
    let x = interaction.inside ? interaction.x : -RADIUS * 2;
    let y = interaction.inside ? interaction.y : -RADIUS * 2;
    let targetX = x;
    let targetY = y;

    const media = {
      fine: matchMedia("(hover: hover) and (pointer: fine)"),
      reduced: matchMedia("(prefers-reduced-motion: reduce)"),
    };
    const tuning = () => {
      settings.current.reduced = media.reduced.matches;
      settings.current.lowPower =
        !media.fine.matches ||
        (navigator as Navigator & { connection?: { saveData?: boolean } })
          .connection?.saveData === true;
    };
    tuning();
    // Media-query listeners are per-effect state: every one added here is
    // removed on cleanup (the previous field leaked these across route swaps).
    const onMediaChange = () => tuning();
    media.fine.addEventListener("change", onMediaChange);
    media.reduced.addEventListener("change", onMediaChange);

    const resolveAccent = () => {
      accent = ACCENT_PALETTES[getAccentColor()].text.join(" ");
    };

    const resize = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      resolveAccent();
      // A resize redraws immediately so a settled field never blanks.
      if (!frame) draw(0);
    };

    const draw = (dt: number) => {
      // Damped follow — the field centre trails the cursor slightly, the
      // same easing MotionEngine applies to the scene variables.
      const ease = 1 - Math.exp(-14 * dt);
      const dx = targetX - x;
      const dy = targetY - y;
      x += dx * ease;
      y += dy * ease;
      // Cursor velocity, heavily damped: it sways the segments and decays
      // toward the radial compass when the pointer rests.
      const velocityEase = 1 - Math.exp(-8 * dt);
      vx += ((dx / Math.max(dt, 0.001)) * 0.00035 - vx) * velocityEase;
      vy += ((dy / Math.max(dt, 0.001)) * 0.00035 - vy) * velocityEase;
      const speed = Math.min(1, Math.hypot(vx, vy));
      const lean = speed * SWAY;

      context.clearRect(0, 0, width, height);
      context.strokeStyle = `rgb(${accent})`;
      context.lineCap = "round";

      // Only segments inside the influence disc are touched each frame.
      const columns = Math.ceil(width / CELL);
      const rows = Math.ceil(height / CELL);
      const startX = Math.max(0, Math.floor((x - RADIUS) / CELL));
      const endX = Math.min(columns - 1, Math.ceil((x + RADIUS) / CELL));
      const startY = Math.max(0, Math.floor((y - RADIUS) / CELL));
      const endY = Math.min(rows - 1, Math.ceil((y + RADIUS) / CELL));

      for (let gx = startX; gx <= endX; gx++) {
        for (let gy = startY; gy <= endY; gy++) {
          const cx = gx * CELL + CELL / 2;
          const cy = gy * CELL + CELL / 2;
          const ox = cx - x;
          const oy = cy - y;
          const distance = Math.hypot(ox, oy);
          if (distance > RADIUS) continue;
          // Linear falloff with a flat core, smoothstep-shaped: solid
          // needles at the centre, dissolving ticks at the rim.
          const t = distance <= CORE ? 0 : (distance - CORE) / (RADIUS - CORE);
          const shaped = 1 - t * t * (3 - 2 * t);
          // Direction: point at the cursor (radial compass), then lean the
          // whole local field toward the motion vector while moving.
          let angle = Math.atan2(-oy, -ox);
          if (lean > 0.001) {
            const motionAngle = Math.atan2(vy, vx);
            // Shortest-path blend between the two angles.
            let delta = motionAngle - angle;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            angle += delta * lean;
          }
          const half = (MIN_LENGTH + (MAX_LENGTH - MIN_LENGTH) * shaped) / 2;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          context.globalAlpha = BASE_ALPHA * shaped;
          context.lineWidth = 1.5;
          context.beginPath();
          context.moveTo(cx - cos * half, cy - sin * half);
          context.lineTo(cx + cos * half, cy + sin * half);
          context.stroke();
        }
      }
      context.globalAlpha = 1;
    };

    const render = (now: number) => {
      frame = 0;
      if (!visible || paused || settings.current.reduced) return;
      const dt = Math.min((now - (previous || now)) / 1000, 0.05);
      previous = now;
      draw(dt);
      // Keep easing while the centre chases its target (input or the fade
      // out after leaving) or the sway is still relaxing.
      if (
        Math.abs(targetX - x) > 0.1 ||
        Math.abs(targetY - y) > 0.1 ||
        Math.hypot(vx, vy) > 0.002
      )
        frame = requestAnimationFrame(render);
    };

    const wake = () => {
      if (
        !frame &&
        visible &&
        !paused &&
        !settings.current.reduced &&
        !settings.current.lowPower
      )
        frame = requestAnimationFrame(render);
    };
    const sync = () => {
      // The store filters touch pointermove; coarse pointers never see the
      // field (no hover concept), same gate as the fluid background.
      if (!interaction.inside || !media.fine.matches) return;
      targetX = interaction.x;
      targetY = interaction.y;
      active = true;
      wake();
    };
    const syncMotion = () => {
      visible = !document.hidden;
      paused = document.documentElement.dataset.motion === "paused";
      if (!visible || paused) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (active) wake();
    };
    const leave = () => {
      active = false;
      // Slide the centre off-canvas — segments shrink to ticks as it goes.
      targetX = -RADIUS * 2;
      targetY = -RADIUS * 2;
      wake();
    };

    resize();
    const unsubscribe = subscribeInteraction(sync);
    const unsubscribeAccent = subscribeAccentColor(() => { resolveAccent(); wake(); });
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", syncMotion);
    window.addEventListener("portfolio-motion", syncMotion);
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);

    return () => {
      unsubscribe();
      unsubscribeAccent();
      cancelAnimationFrame(frame);
      media.fine.removeEventListener("change", onMediaChange);
      media.reduced.removeEventListener("change", onMediaChange);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", syncMotion);
      window.removeEventListener("portfolio-motion", syncMotion);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
    };
  }, []);

  // Layering is owned by CSS (background-system.css): on portfolio routes the
  // canvas lives UNDER the content (z -1, above the -2 background stack), so
  // text never reads through the field. The lab's opaque page surface needs
  // it ABOVE (html[data-lab-route]) — a stylesheet decision, not an inline one.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-cursor-field=""
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
