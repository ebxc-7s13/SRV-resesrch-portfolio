"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Phase = "idle" | "to-center" | "hold" | "return";
type Origin = { x: number; y: number; size: number };

const FLY_MS = 750;
const HOLD_MS = 3000;
const SHOW_MAX = 560;

/**
 * Footer logo theater. Clicking the thumbnail tumbles a large copy out to
 * screen center (three fast revolutions on both the X and Y axes, with a
 * soft smoke wisp blooming behind it), holds it for 3 seconds, then tumbles
 * it back into place. The overlay portals to document.body so it always paints
 * above the page (the footer's own stacking context would bury it). The
 * thumbnail hides in place while the copy flies so the layout never shifts.
 *
 * Safety: timers are tracked and cleared on unmount; re-clicks mid-flight
 * are ignored; Escape/backdrop-click returns early; the return target is
 * re-measured (scroll-safe); reduced-motion users get a static 3s hold.
 */
export default function FooterLogo() {
  const thumbRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [placed, setPlaced] = useState(false);
  const [center, setCenter] = useState<Origin | null>(null);
  const [reduced, setReduced] = useState(false);
  // Portal target only exists in the browser; footer stacking contexts
  // (relative z-10) would otherwise trap the fixed overlay below the page.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    },
    [],
  );

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const finish = useCallback(() => {
    setPhase("idle");
    setOrigin(null);
    setCenter(null);
    setPlaced(false);
  }, []);

  const snapshot = useCallback((): Origin | null => {
    const el = thumbRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    if (!Number.isFinite(size) || size <= 0) return null;
    return { x: rect.left, y: rect.top, size };
  }, []);

  const computeCenter = useCallback((): Origin => {
    const show = Math.max(
      120,
      Math.min(
        SHOW_MAX,
        Math.min(window.innerWidth, window.innerHeight) * 0.78,
      ),
    );
    return {
      x: (window.innerWidth - show) / 2,
      y: (window.innerHeight - show) / 2,
      size: show,
    };
  }, []);

  const goReturn = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    const fresh = snapshot();
    if (fresh) setOrigin(fresh);
    setPlaced(true);
    setPhase("return");
    later(() => finish(), FLY_MS + 80);
  }, [finish, later, snapshot]);

  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") goReturn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, goReturn]);

  // Flip to the center geometry one beat after mount so the flight
  // transition has a painted starting frame to animate from.
  useEffect(() => {
    if (phase !== "to-center" || placed) return;
    const id = window.setTimeout(() => setPlaced(true), 60);
    return () => window.clearTimeout(id);
  }, [phase, placed]);

  // Stay centered across viewport resizes during the flight/hold.
  useEffect(() => {
    if (phase !== "to-center" && phase !== "hold") return;
    const onResize = () => setCenter(computeCenter());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [phase, computeCenter]);

  const play = useCallback(() => {
    if (phase !== "idle") return;
    const start = snapshot();
    if (!start) return;
    setOrigin(start);
    setCenter(computeCenter());
    setPlaced(false);
    if (reduced) {
      setPlaced(true);
      setPhase("hold");
      later(() => finish(), HOLD_MS);
      return;
    }
    setPhase("to-center");
    later(() => setPhase("hold"), FLY_MS + 80);
    later(() => goReturn(), FLY_MS + 80 + HOLD_MS);
  }, [computeCenter, finish, goReturn, later, phase, reduced, snapshot]);

  const active = phase !== "idle";
  // Return leg flies home; every other active leg shows the center copy.
  // Pure-pixel geometry on both ends so the flight interpolates smoothly.
  const box =
    phase === "return" ? origin : placed && center ? center : origin;
  // Dual-axis tumble: a flat coin-spin plus a forward flip, three fast
  // revolutions each way (1080deg ≡ identity, so holds render perfectly
  // static).
  const spin =
    phase === "return"
      ? "rotateX(2160deg) rotateY(2160deg)"
      : placed || phase === "hold"
        ? "rotateX(1080deg) rotateY(1080deg)"
        : "none";
  const smoking = active && placed && phase !== "return";

  return (
    <>
      <button
        ref={thumbRef}
        type="button"
        onClick={play}
        aria-label="Animate logo"
        tabIndex={active ? -1 : undefined}
        className={active ? "shrink-0 opacity-0" : "shrink-0"}
      >
        {/* sizes pins the served variant to the real 144px box. Without it the
            browser assumes 100vw and pulls an oversized copy of the source
            for a thumbnail; with it, next/image serves a small candidate.
            No visual change — same image, right size. */}
        <Image
          src="/mylogo.png"
          alt="Siluveru Raja Viveka Vardhan logo"
          width={1024}
          height={1025}
          sizes="144px"
          className="h-36 w-auto"
          aria-hidden={active}
        />
      </button>
      {mounted &&
        active &&
        box &&
        createPortal(
          <div
            className="fixed inset-0 z-[90]"
            style={{ perspective: "1000px" }}
            aria-hidden="true"
            onClick={goReturn}
          >
          <div
            className="absolute inset-0 bg-black/90"
              style={{
                opacity: phase === "return" ? 0 : 1,
                transition: "opacity 0.4s ease",
              }}
            />
            <div
              className="absolute"
              style={{
                left: box.x,
                top: box.y,
                width: box.size,
                height: box.size,
                opacity: smoking ? 1 : 0,
                transform: `scale(${phase === "hold" ? 1.25 : 0.8})`,
                transition: "opacity 0.8s ease, transform 3.2s ease",
                filter: "blur(28px)",
                background:
                  "radial-gradient(circle at 30% 40%, rgb(255 255 255 / 0.35), transparent 60%), radial-gradient(circle at 70% 60%, rgb(200 210 215 / 0.28), transparent 55%), radial-gradient(circle at 50% 50%, rgb(183 255 74 / 0.12), transparent 70%)",
              }}
            />
            <div
              className="absolute"
              style={{
                left: box.x,
                top: box.y,
                width: box.size,
                height: box.size,
                transform: spin,
                transition:
                  "left 0.75s ease, top 0.75s ease, width 0.75s ease, height 0.75s ease, transform 0.75s ease",
              }}
            >
              {/* The theatre copy renders inside a portal that is at most
                  ~60vw wide, so ask for that instead of the full source. */}
              <Image
                src="/mylogo.png"
                alt=""
                width={1024}
                height={1025}
                sizes="(max-width: 768px) 85vw, 60vw"
                className="h-full w-full"
                draggable={false}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
