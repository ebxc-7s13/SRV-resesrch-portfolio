"use client";

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { getAccentColor, subscribeAccentColor } from "@/lib/accent-color";
import { ACCENT_PALETTES } from "@/lib/accent-palette";

const HOT = [255, 255, 255];

/**
 * Cursor-speed heat tint for the neon hero name. On pointer movement each
 * character lerps from the selected accent toward white-hot by proximity to the
 * cursor; a faster cursor widens the radius and deepens saturation.
 * Text color only — no backgrounds, no layout, no Shuffle interference
 * (Shuffle owns textContent/opacity; this owns color). Respects
 * prefers-reduced-motion by staying out of the way entirely.
 */
export default function HeroNameHover({
  children,
}: {
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const base = useRef<readonly number[]>(ACCENT_PALETTES.green.text);
  const state = useRef({
    x: 0,
    v: 0,
    lx: 0,
    lt: 0,
    raf: 0,
    running: false,
    left: true,
  });

  useEffect(() => {
    const sync = () => {
      base.current = ACCENT_PALETTES[getAccentColor()].text;
      wrapRef.current?.querySelectorAll<HTMLElement>(".shuffle-char").forEach(char => { char.style.color = ""; });
    };
    sync();
    const unsubscribe = subscribeAccentColor(sync);
    const animation = state.current;
    return () => { unsubscribe(); cancelAnimationFrame(animation.raf); animation.running = false; };
  }, []);

  const mix = (t: number) => {
    const r = Math.round(base.current[0] + (HOT[0] - base.current[0]) * t);
    const g = Math.round(base.current[1] + (HOT[1] - base.current[1]) * t);
    const b = Math.round(base.current[2] + (HOT[2] - base.current[2]) * t);
    return `rgb(${r} ${g} ${b})`;
  };

  const reduced = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const frame = () => {
    const s = state.current;
    const el = wrapRef.current;
    if (!el) {
      s.running = false;
      return;
    }
    const chars = el.querySelectorAll(".shuffle-char");
    if (chars.length === 0) {
      s.running = false;
      return;
    }
    const now = performance.now();
    if (now - s.lt > 90) s.v *= 0.92;
    const radius = 90 + Math.min(s.v, 3) * 80;
    const gain = Math.min(1, 0.55 + s.v * 0.3);
    let alive = !s.left;
    chars.forEach((node) => {
      const c = node as HTMLElement;
      const rect = c.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const d = s.left ? Number.POSITIVE_INFINITY : Math.abs(cx - s.x);
      const t =
        d === Number.POSITIVE_INFINITY
          ? 0
          : Math.pow(Math.max(0, 1 - d / radius), 1.5) * gain;
      if (t > 0.01) {
        c.style.color = mix(t);
        alive = true;
      } else if (c.style.color) {
        c.style.color = "";
      }
    });
    if (alive) {
      s.raf = requestAnimationFrame(frame);
    } else {
      s.running = false;
    }
  };

  const kick = () => {
    if (reduced()) return;
    const s = state.current;
    if (s.running) return;
    s.running = true;
    s.raf = requestAnimationFrame(frame);
  };

  const onMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    const s = state.current;
    const now = performance.now();
    const dt = Math.max(8, now - s.lt);
    const inst = Math.abs(e.clientX - s.lx) / dt;
    s.v = s.v * 0.7 + Math.min(inst, 4) * 0.3;
    s.lx = e.clientX;
    s.lt = now;
    s.left = false;
    s.x = e.clientX;
    kick();
  };

  const onLeave = () => {
    state.current.left = true;
    kick();
  };

  return (
    <span
      ref={wrapRef}
      className="hero-name-hover"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </span>
  );
}
