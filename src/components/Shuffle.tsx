"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(SplitText, ScrollTrigger, useGSAP);

const GLYPHS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+-=[]{};:,.<>?";

type ShuffleProps = {
  text: string;
  className?: string;
  shuffleDirection?: "left" | "right";
  shuffleTimes?: number;
  duration?: number;
  animationMode?: "evenodd" | "sequential";
  ease?: string;
  stagger?: number;
  threshold?: number;
  triggerOnce?: boolean;
  triggerOnHover?: boolean;
  respectReducedMotion?: boolean;
  loop?: boolean;
  loopDelay?: number;
  onShuffleComplete?: () => void;
};

/**
 * Shuffle text entrance (React Bits behavior) for a single element: splits
 * the text into characters once webfonts are ready (no reflow), plays a
 * glyph-scramble settle when scrolled into view, and replays it on hover.
 * Screen readers get the intact label; reduced motion gets plain text.
 */
export default function Shuffle({
  text,
  className,
  shuffleDirection = "right",
  shuffleTimes = 1,
  duration = 0.35,
  animationMode = "evenodd",
  ease = "power3.out",
  stagger = 0.03,
  threshold = 0.1,
  triggerOnce = true,
  triggerOnHover = true,
  respectReducedMotion = true,
  loop = false,
  loopDelay = 0,
  onShuffleComplete,
}: ShuffleProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const playingRef = useRef(false);
  const loopBuiltRef = useRef(false);
  const completeRef = useRef(onShuffleComplete);
  completeRef.current = onShuffleComplete;

  useGSAP(
    () => {
      const el = rootRef.current;
      if (!el) return;
      if (
        respectReducedMotion &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      let split: SplitText | null = null;
      let tl: gsap.core.Timeline | null = null;
      let trigger: ScrollTrigger | null = null;
      let alive = true;
      const pick = () =>
        GLYPHS[(Math.random() * GLYPHS.length) | 0];

      const play = () => {
        if (!alive || !split || playingRef.current) return;
        if (loop && loopBuiltRef.current) return;
        playingRef.current = true;
        tl?.kill();
        const chars = (split.chars ?? []) as HTMLElement[];
        const order =
          animationMode === "evenodd"
            ? [
                ...chars.filter((_, i) =>
                  shuffleDirection === "right" ? i % 2 === 0 : i % 2 !== 0,
                ),
                ...chars.filter((_, i) =>
                  shuffleDirection === "right" ? i % 2 !== 0 : i % 2 === 0,
                ),
              ]
            : shuffleDirection === "right"
              ? chars
              : [...chars].reverse();
        tl = gsap.timeline({
          onComplete: () => {
            playingRef.current = false;
            completeRef.current?.();
          },
        });
        if (loop) {
          tl.repeat(-1);
          tl.repeatDelay(loopDelay);
          loopBuiltRef.current = true;
        }
        let step = 0;
        for (const ch of order) {
          const orig = ch.dataset.orig ?? "";
          if (orig.trim() === "") continue;
          const at = step * stagger;
          for (let k = 0; k < shuffleTimes; k++) {
            tl.set(ch, { textContent: pick() }, at + k * 0.045);
          }
          tl.set(ch, { textContent: orig }, at + shuffleTimes * 0.045);
          tl.fromTo(
            ch,
            { opacity: 0.25 },
            { opacity: 1, duration, ease },
            at + shuffleTimes * 0.045,
          );
          step += 1;
        }
      };

      const onHover = () => {
        if (triggerOnHover && !loop) play();
      };

      document.fonts.ready.then(() => {
        if (!alive || !el.isConnected) return;
        split = SplitText.create(el, {
          type: "chars",
          charsClass: "shuffle-char",
        });
        const chars = (split.chars ?? []) as HTMLElement[];
        el.setAttribute("aria-label", text);
        for (const ch of chars) {
          ch.dataset.orig = ch.textContent ?? "";
          ch.setAttribute("aria-hidden", "true");
        }
        el.addEventListener("mouseenter", onHover);
        trigger = ScrollTrigger.create({
          trigger: el,
          start: `top ${(1 - threshold) * 100}%`,
          once: triggerOnce,
          onEnter: play,
        });
        // Already in view on mount (hero): ScrollTrigger fires onEnter
        // itself, so no manual kick is needed.
      });

      return () => {
        alive = false;
        el.removeEventListener("mouseenter", onHover);
        trigger?.kill();
        trigger = null;
        tl?.kill();
        tl = null;
        split?.revert();
        split = null;
        el.removeAttribute("aria-label");
        playingRef.current = false;
        loopBuiltRef.current = false;
      };
    },
    {
      scope: rootRef,
      dependencies: [
        text,
        shuffleDirection,
        shuffleTimes,
        duration,
        animationMode,
        ease,
        stagger,
        threshold,
        triggerOnce,
        triggerOnHover,
        respectReducedMotion,
        loop,
        loopDelay,
      ],
    },
  );

  return (
    <span ref={rootRef} className={className}>
      {text}
    </span>
  );
}
