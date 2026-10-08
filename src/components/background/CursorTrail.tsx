"use client";

import { useEffect, useRef } from "react";
import { interaction, subscribeInteraction } from "@/lib/interaction";

/**
 * Laser cursor trail — a ray of light streaming behind the native neon-green
 * cursor (see globals.css "Site cursor").
 *
 * A fixed canvas keeps the last ~420ms of pointer positions and strokes them
 * oldest → newest as one tapered beam: soft neon glow, colored core and a
 * white-hot center that narrows toward the tail. Fast motion spaces the
 * samples out and stretches the ray; slow motion keeps it short and dense.
 * The native cursor image stays the head; this canvas only paints the ray.
 *
 * Perf contract (same as CursorField):
 * - One shared input source: reads the shared `interaction` store via
 *   `subscribeInteraction` — no pointer listeners of its own.
 * - At most MAX_POINTS segments per frame, stroke/fill only (no shadowBlur),
 *   DPR capped.
 * - The rAF loop runs only while live points exist; it stops when the ray
 *   has fully faded. Gates: fine pointer + mouse only, inert under
 *   prefers-reduced-motion, cancelled on hidden tab / paused motion, skipped
 *   on saveData.
 */

const TRAIL_MS = 420; // how long each ray sample survives before fading out
const MAX_POINTS = 22; // bound on segments per frame
const HEAD_W = 3.5; // px core width at the freshest point
const TAIL_W = 0.8; // px core width floor for the oldest visible sample
const HEAD_ALPHA = 0.55; // peak core opacity — deliberately under the cursor head
const GLOW_ALPHA = 0.1; // wide soft pass that turns the core into light
const MIN_PUSH_PX = 2; // ignore sub-pixel jitter between syncs
const DPR_CAP = 1.5;

type TrailPoint = { x: number; y: number; t: number };

export default function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = useRef({ reduced: false, lowPower: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let visible = !document.hidden;
    let paused = document.documentElement.dataset.motion === "paused";
    let accent = "183 255 74";
    let lastPushX = Number.NaN;
    let lastPushY = Number.NaN;
    const points: TrailPoint[] = [];

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
    const onMediaChange = () => tuning();
    media.fine.addEventListener("change", onMediaChange);
    media.reduced.addEventListener("change", onMediaChange);

    const resolveAccent = () => {
      // Theme tokens are plain "r g b" channel triplets on :root; resolve
      // on resize rather than per frame so the trail matches the theme.
      const triplet = getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join(" ");
      if (triplet) accent = triplet;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      canvas.width = Math.round(Math.max(1, window.innerWidth) * dpr);
      canvas.height = Math.round(Math.max(1, window.innerHeight) * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      resolveAccent();
    };

    const draw = (now: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      context.clearRect(0, 0, width, height);
      // Drop samples older than the fade window; the loop stops once empty.
      while (points.length > 0 && now - points[0].t > TRAIL_MS) {
        points.shift();
      }
      if (points.length === 0) {
        context.globalAlpha = 1;
        return;
      }
      context.lineCap = "round";
      context.lineJoin = "round";
      // Oldest → newest, segment by segment so the beam tapers toward the
      // cursor: the ray is literally the pointer's recent path.
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const rank = (i + 1) / points.length; // 0 tail → 1 head
        const age = (now - b.t) / TRAIL_MS; // 0 fresh → 1 gone
        const freshness = Math.max(0, 1 - age);
        if (freshness <= 0) continue;
        const w = TAIL_W + (HEAD_W - TAIL_W) * rank;
        // Soft outer glow → neon core → white-hot center: reads as a ray of
        // light rather than a chain of dots. Round caps fuse the segments.
        context.strokeStyle = `rgb(${accent})`;
        context.globalAlpha = GLOW_ALPHA * freshness;
        context.lineWidth = w * 3.4;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();

        context.globalAlpha = HEAD_ALPHA * freshness * (0.3 + 0.7 * rank);
        context.lineWidth = w;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();

        context.strokeStyle = "rgb(255 255 255)";
        context.globalAlpha = 0.28 * freshness * rank;
        context.lineWidth = Math.max(0.5, w * 0.36);
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
      // Emission point: a small hot dot where the ray leaves the cursor head.
      const head = points[points.length - 1];
      const headFreshness = Math.max(0, 1 - (now - head.t) / TRAIL_MS);
      if (headFreshness > 0) {
        context.fillStyle = `rgb(${accent})`;
        context.globalAlpha = 0.35 * headFreshness;
        context.beginPath();
        context.arc(head.x, head.y, 5, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "rgb(255 255 255)";
        context.globalAlpha = 0.85 * headFreshness;
        context.beginPath();
        context.arc(head.x, head.y, 2.2, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    };

    const render = (now: number) => {
      frame = 0;
      if (!visible || paused || settings.current.reduced) {
        points.length = 0;
        context.clearRect(0, 0, window.innerWidth, window.innerHeight);
        return;
      }
      draw(now);
      // Keep going only while ray samples are still alive; a resting pointer
      // fades out on its own instead of idling the loop.
      if (points.length > 0) frame = requestAnimationFrame(render);
    };

    const wake = () => {
      if (
        !frame &&
        visible &&
        !paused &&
        !settings.current.reduced &&
        !settings.current.lowPower
      ) {
        frame = requestAnimationFrame(render);
      }
    };

    const sync = () => {
      // The store filters touch pointermove; coarse pointers never see the
      // trail (no hover concept), same gate as the cursor field.
      if (!interaction.inside || !media.fine.matches) return;
      const x = interaction.x;
      const y = interaction.y;
      if (
        Number.isFinite(lastPushX) &&
        Math.hypot(x - lastPushX, y - lastPushY) < MIN_PUSH_PX &&
        points.length > 0
      ) {
        return;
      }
      lastPushX = x;
      lastPushY = y;
      points.push({ x, y, t: performance.now() });
      if (points.length > MAX_POINTS) {
        points.splice(0, points.length - MAX_POINTS);
      }
      wake();
    };

    const syncMotion = () => {
      visible = !document.hidden;
      paused = document.documentElement.dataset.motion === "paused";
      if (!visible || paused) {
        cancelAnimationFrame(frame);
        frame = 0;
        points.length = 0;
        context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      } else if (points.length > 0) {
        wake();
      }
    };

    const leave = () => {
      // Don't clear instantly: letting the buffer age out gives the
      // requested fade-out instead of a pop.
      lastPushX = Number.NaN;
      lastPushY = Number.NaN;
      wake();
    };

    resize();
    const unsubscribe = subscribeInteraction(sync);
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", syncMotion);
    window.addEventListener("portfolio-motion", syncMotion);
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);

    return () => {
      unsubscribe();
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

  // Layering is owned by CSS (background-system.css): fixed, topmost but
  // pointer-transparent, hidden on touch / reduced-motion / print.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-cursor-trail=""
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
