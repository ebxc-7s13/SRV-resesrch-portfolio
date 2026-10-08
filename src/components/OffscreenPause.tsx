"use client";

import { useEffect } from "react";
import {
  isHydrated,
  whenFullyHydrated,
} from "@/lib/hydration";

// Attribute written onto an animated element while it sits outside the
// viewport. globals.css turns it into `animation-play-state: paused` for the
// element and both of its pseudo-elements.
const ATTR = "data-anim-paused";

/**
 * Suspends offscreen CSS loops.
 *
 * The page runs a number of continuous CSS animations — the two marquee
 * strips, the drifting starfield painted on every depth card / hero plane,
 * the shimmer sweep on lead paragraphs, the patent ring, the lab spinner.
 * Offscreen they still cost frames: `background-position` loops repaint on
 * every tick, and a long page can carry dozens of them at once.
 *
 * Rather than tag each call site (and keep that list in sync as new animated
 * surfaces appear), this asks the document which CSS animations are actually
 * running and infinite, then watches only those elements. Finite entrances and
 * transitions are left alone: they either already finished or should be
 * allowed to complete. Animations that CSS itself holds paused (the galaxy
 * ring, the hovered marquee) never appear as `running` here, so their own
 * play-state rules keep working untouched.
 *
 * Pausing holds an animation at its current progress, so a loop that resumes
 * on re-entry continues from exactly where it left off — no visible change.
 */
export default function OffscreenPause() {
  useEffect(() => {
    if (typeof document.getAnimations !== "function") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tracked = new Set<HTMLElement>();
    let timer = 0;
    let idleHandle = 0;
    let rafHandle = 0;
    let lateSweep = 0;
    let stopped = false;
    // Hydration-safe gate (mirrors MotionEngine): no DOM writes until window
    // load AND every element is branded AND the main thread is idle. Home is
    // an async force-dynamic route, so streamed Suspense boundaries can
    // hydrate in later passes — a bare timeout/idle callback can still fire
    // mid-hydration and land a `data-anim-paused` write on a node React is
    // about to verify (the exact mismatch on `/`). The global
    // `whenFullyHydrated` gate closes most of that window, and the per-write
    // `isHydrated` checks below close the rest for late-streamed nodes.
    let ready = false;

    // 200px of lead time: a strip resumes just before it is visible, which
    // keeps the resume off the scroll's critical path without letting a
    // visible element sit frozen.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!ready || stopped) return;
        let needsRetry = false;
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (!el.isConnected) continue;
          // Never touch a node React has not taken over yet: its server
          // markup is still awaiting verification, so any write here
          // becomes a hydration mismatch.
          if (!isHydrated(el)) {
            needsRetry = true;
            continue;
          }
          if (entry.isIntersecting) el.removeAttribute(ATTR);
          else el.setAttribute(ATTR, "true");
        }
        if (needsRetry) schedule();
      },
      { rootMargin: "200px 0px" },
    );

    // The animation's own timing is unreliable for this: `getTiming()` and
    // `getComputedTiming()` both report `iterations: null` for a CSS animation
    // whose iteration count came from the stylesheet. The resolved value on
    // the element is the dependable answer, so ask the style system — once per
    // element and pseudo per sweep, since that answer cannot change.
    const memo = new Map<Element, Map<string, boolean>>();
    const isInfinite = (el: Element, pseudo: string) => {
      let byPseudo = memo.get(el);
      if (!byPseudo) {
        byPseudo = new Map();
        memo.set(el, byPseudo);
      }
      const cached = byPseudo.get(pseudo);
      if (cached !== undefined) return cached;
      const value = getComputedStyle(el, pseudo || undefined)
        .animationIterationCount.split(",")
        .some((count) => count.trim() === "infinite");
      byPseudo.set(pseudo, value);
      return value;
    };

    const collect = () => {
      timer = 0;
      if (stopped || !ready) return;
      memo.clear();
      let skipped = false;
      for (const animation of document.getAnimations()) {
        // Transitions carry no animationName; only CSS keyframe animations are
        // candidates for suspension.
        const name = (animation as Animation & { animationName?: string })
          .animationName;
        if (!name) continue;
        if (animation.playState !== "running") continue;
        const effect = animation.effect as KeyframeEffect | null;
        const target = effect?.target;
        if (!(target instanceof HTMLElement) || !target.isConnected) continue;
        // Skip nodes React has not taken over yet (late-streamed Suspense
        // content). Observing them now would let the observer callback write
        // before hydration verifies them. Retry on the next sweep instead.
        if (!isHydrated(target)) {
          skipped = true;
          continue;
        }
        // Infinite loops only. Finite entrances are either finished or on
        // their way there and must not be frozen mid-arrival.
        if (!isInfinite(target, effect?.pseudoElement || "")) continue;
        if (tracked.has(target)) continue;
        tracked.add(target);
        observer.observe(target);
      }
      // Keep both the set and the observation list bounded as routes swap.
      for (const el of tracked) {
        if (!el.isConnected) {
          observer.unobserve(el);
          tracked.delete(el);
        }
      }
      if (skipped) schedule();
    };

    const schedule = () => {
      if (stopped || timer) return;
      // Coalesce the mutation storm that hydration and route swaps produce
      // into a single sweep per quiet window.
      timer = window.setTimeout(collect, 180);
    };

    // The first sweep waits for load + full hydration + idle so it never
    // competes with hydration or the first paint. The late sweep after it
    // matters because this page is server-rendered — hydration inserts almost
    // nothing — and the loops it targets (the starfield, the marquee strips)
    // start from CSS, so there is no DOM change to react to. It also lands
    // after the global motion gate has flipped on, catching anything that
    // only animates once it is running.
    const idle = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const finish = () => {
      if (stopped || ready) return;
      ready = true;
      schedule();
      lateSweep = window.setTimeout(schedule, 1600);
    };
    const scheduleIdle = () => {
      if (stopped || ready) return;
      if (idle.requestIdleCallback) {
        idleHandle = idle.requestIdleCallback(() => finish(), {
          timeout: 1500,
        });
      } else {
        // No requestIdleCallback (Safari): two frames after load.
        rafHandle = requestAnimationFrame(() =>
          requestAnimationFrame(() => finish()),
        );
      }
    };
    const gate = () => {
      if (stopped) return;
      void whenFullyHydrated().then(scheduleIdle);
    };
    if (document.readyState === "complete") gate();
    else window.addEventListener("load", gate, { once: true });

    // Animations start and stop as the shell swaps routes and as the global
    // motion gate flips, so re-sweep on DOM changes and on that one attribute.
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion-running"],
      childList: true,
      subtree: true,
    });
    window.addEventListener("portfolio-motion", schedule);

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      if (lateSweep) window.clearTimeout(lateSweep);
      if (idleHandle) idle.cancelIdleCallback?.(idleHandle);
      if (rafHandle) cancelAnimationFrame(rafHandle);
      window.removeEventListener("load", gate);
      mutations.disconnect();
      window.removeEventListener("portfolio-motion", schedule);
      observer.disconnect();
      tracked.forEach((el) => el.removeAttribute(ATTR));
      tracked.clear();
    };
  }, []);

  return null;
}
