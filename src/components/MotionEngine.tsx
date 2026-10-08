"use client";
import { useEffect, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { subscribeInteraction, interaction } from "@/lib/interaction";
import { isHydrated, whenFullyHydrated } from "@/lib/hydration";

gsap.registerPlugin(ScrollTrigger);

// Surfaces that respond to the pointer. `data-depth` / `data-magnet` are the
// existing depth cards and magnetic CTAs; `data-pointer` is the light-only
// tier (nav items, environment controls) that tracks the cursor inside the
// control without ever writing a transform, so hit targets never move.
const POINTER_TARGETS = "[data-depth],[data-magnet],[data-pointer]";
export default function MotionEngine({
  allowed,
  path,
}: {
  allowed: boolean;
  path: string;
}) {
  // Hydration-safe gate. The engine writes inline styles and data attributes
  // onto React-owned DOM (GSAP eyebrow reveals, data-in-view flags), so any
  // write before hydration verification lands a hydration mismatch. Timers
  // and per-node checks are both insufficient: idle callbacks fire
  // mid-hydration, and a branded node can still be re-diffed when a streamed
  // boundary hydrates in a later pass. The only dependable signal is GLOBAL:
  // every element in the body is branded, which is the state after the final
  // hydration commit (see lib/hydration). So: window load → every element
  // branded → one idle callback / frame.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let idleHandle = 0;
    let rafHandle = 0;
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const finish = () => {
      if (!cancelled) setReady(true);
    };
    const scheduleIdle = () => {
      if (cancelled) return;
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(() => finish(), {
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
      if (cancelled) return;
      void whenFullyHydrated().then(scheduleIdle);
    };
    if (document.readyState === "complete") gate();
    else window.addEventListener("load", gate, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", gate);
      if (idleHandle) idleWindow.cancelIdleCallback?.(idleHandle);
      if (rafHandle) cancelAnimationFrame(rafHandle);
    };
  }, []);
  // NOTE: title word reveals are server-rendered (SplitWords) and animated by
  // CSS, so this engine only ever writes inline styles — it never mutates the
  // React-owned DOM structure. All writes wait for the load + hydration + idle
  // gate above, so React's hydration verification always sees the pristine
  // server DOM.
  useGSAP(
    () => {
      if (!allowed || !ready) return;
      const root = document.querySelector<HTMLElement>(".portfolio-shell");
      if (!root) return;
      const hero = root.querySelector(".hero-composition");
      if (hero && innerWidth > 760)
        gsap.fromTo(
          hero,
          { y: 0 },
          {
            y: -65,
            ease: "none",
            immediateRender: false,
            scrollTrigger: {
              trigger: hero,
              start: "top top",
              end: "bottom top",
              scrub: 0.65,
            },
          },
        );
      // Section-heading arrivals. Blur is reserved for text nodes — panels
      // only fade and rise, keeping paint cost bounded.
      gsap.utils
        .toArray<HTMLElement>(
          ".page-header .eyebrow, .lab-section-heading, [data-scroll-reveal]",
          root,
        )
        .forEach((el) => {
          const isText =
            /^(H[1-6]|P|SPAN)$/.test(el.tagName) ||
            el.classList.contains("eyebrow");
          gsap.fromTo(
            el,
            {
              opacity: 0.22,
              y: 24,
              ...(isText ? { filter: "blur(5px)" } : {}),
            },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.75,
              ease: "power2.out",
              scrollTrigger: { trigger: el, start: "top 90%", once: true },
              clearProps: "transform,opacity,filter",
            },
          );
        });
    },
    { dependencies: [allowed, path, ready], revertOnUpdate: true },
  );
  useEffect(() => {
    if (!ready) return;
    const root = document.querySelector<HTMLElement>(".portfolio-shell");
    if (!root) return;
    // Per-property write cache. The engine re-derives every variable each
    // frame while damping, then converges and repeats the identical string —
    // the pointer workload measured ~65-70% duplicate assignments. Skipping
    // unchanged writes removes that style work without changing a single
    // rendered value. WeakMap keeps removed nodes from being retained.
    const written = new WeakMap<Element, Map<string, string>>();
    const write = (el: HTMLElement, property: string, value: string) => {
      let cache = written.get(el);
      if (!cache) {
        cache = new Map();
        written.set(el, cache);
      }
      if (cache.get(property) === value) return;
      cache.set(property, value);
      el.style.setProperty(property, value);
    };
    const reset = () => {
      write(root, "--scene-x", "0");
      write(root, "--scene-y", "0");
      root
        .querySelectorAll<HTMLElement>("[data-depth],[data-magnet]")
        .forEach((el) => {
          // data-pointer surfaces are deliberately not reset: their glow only
          // shows while hovered, so a stale coordinate is never visible.
          write(el, "--tilt-x", "0deg");
          write(el, "--tilt-y", "0deg");
          write(el, "--magnet-x", "0px");
          write(el, "--magnet-y", "0px");
        });
    };
    if (!allowed) {
      reset();
      return;
    }
    const fine = matchMedia(
      "(hover:hover) and (pointer:fine) and (min-width:769px)",
    );
    let frame = 0,
      lastTime = 0,
      x = 0,
      y = 0,
      lastScroll = interaction.scroll,
      scrollVelocity = 0,
      card: HTMLElement | null = null,
      tiltX = 0,
      tiltY = 0,
      magX = 0,
      magY = 0;
    const seen = new Set<HTMLElement>(),
      visible = new Set<HTMLElement>();
    // Field nodes are discovered with the MutationObserver below and cached —
    // querySelectorAll per frame walked the whole shell 60×/s.
    const fieldNodes = new Set<HTMLElement>();
    const render = (time: number) => {
      frame = 0;
      const t =
        1 - Math.exp(-12 * Math.min(0.05, (time - lastTime) / 1000 || 0.016));
      lastTime = time;
      const tx = fine.matches && interaction.inside ? interaction.nx : 0,
        ty = fine.matches && interaction.inside ? interaction.ny : 0;
      x += (tx - x) * t;
      y += (ty - y) * t;
      // Damped scroll-velocity signal (0..1) for flow instruments.
      scrollVelocity +=
        (Math.min(1, Math.abs(interaction.scroll - lastScroll) / 1200) -
          scrollVelocity) *
        t;
      lastScroll = interaction.scroll;
      write(root, "--scene-x", x.toFixed(4));
      write(root, "--scene-y", y.toFixed(4));
      write(root, "--mx", `${(x + 0.5) * 100}%`);
      write(root, "--my", `${(y + 0.5) * 100}%`);
      write(
        root,
        "--page-depth",
        `${Math.min(interaction.scroll * 0.028, 65)}px`,
      );
      write(root, "--scroll-progress", String(interaction.progress));
      write(root, "--scroll-velocity", scrollVelocity.toFixed(4));
      let next =
        fine.matches && interaction.inside
          ? interaction.target?.closest<HTMLElement>(POINTER_TARGETS) || null
          : null;
      // Keyboard parity: focused elements inside a depth card light it up too.
      if (!next && document.activeElement instanceof HTMLElement) {
        next = document.activeElement.closest<HTMLElement>(POINTER_TARGETS);
      }
      if (card !== next) {
        if (card) {
          write(card, "--tilt-x", "0deg");
          write(card, "--tilt-y", "0deg");
          write(card, "--magnet-x", "0px");
          write(card, "--magnet-y", "0px");
        }
        card = next;
        tiltX = 0;
        tiltY = 0;
        magX = 0;
        magY = 0;
      }
      let remainder = Math.abs(tx - x) + Math.abs(ty - y);
      if (card) {
        const r = card.getBoundingClientRect(),
          cx = Math.max(
            -0.5,
            Math.min(0.5, (interaction.x - r.left) / r.width - 0.5),
          ),
          cy = Math.max(
            -0.5,
            Math.min(0.5, (interaction.y - r.top) / r.height - 0.5),
          );
        if (card.hasAttribute("data-magnet")) {
          // Magnetic buttons (Aceternity pattern): a small damped pull only.
          // No tilt, no glass, and hit targets never move more than ~4px.
          magX += (cx * 12 - magX) * t;
          magY += (cy * 12 - magY) * t;
          remainder += Math.abs(cx * 12 - magX) + Math.abs(cy * 12 - magY);
          write(card, "--magnet-x", `${magX.toFixed(2)}px`);
          write(card, "--magnet-y", `${magY.toFixed(2)}px`);
        } else if (card.hasAttribute("data-depth")) {
          tiltX += (-cy * 8 - tiltX) * t;
          tiltY += (cx * 10 - tiltY) * t;
          remainder += Math.abs(-cy * 8 - tiltX) + Math.abs(cx * 10 - tiltY);
          write(card, "--tilt-x", `${tiltX}deg`);
          write(card, "--tilt-y", `${tiltY}deg`);
          write(card, "--glass-x", `${(cx + 0.5) * 100}%`);
          write(card, "--glass-y", `${(cy + 0.5) * 100}%`);
          write(card, "--magnet-x", `${cx * 8}px`);
          write(card, "--magnet-y", `${cy * 8}px`);
        } else {
          // Light-only surfaces (nav items, environment controls): the glow
          // tracks the cursor inside the control, and nothing else is written.
          // No damped remainder here either, so an idle hover lets the frame
          // loop stop as soon as the scene variables settle.
          write(card, "--glass-x", `${(cx + 0.5) * 100}%`);
          write(card, "--glass-y", `${(cy + 0.5) * 100}%`);
        }
      }
      visible.forEach((el) => {
        const r = el.getBoundingClientRect();
        write(
          el,
          "--reveal-depth",
          `${Math.max(-18, Math.min(18, (r.top - innerHeight * 0.45) * 0.025))}px`,
        );
      });
      fieldNodes.forEach((el) => {
        const px = Number(el.dataset.x),
          py = Number(el.dataset.y),
          dx = (x + 0.5) * 100 - px,
          dy = (y + 0.5) * 100 - py,
          influence = Math.max(0, 1 - Math.hypot(dx, dy) / 30);
        write(el, "--node-x", `${-dx * influence * 0.65}px`);
        write(el, "--node-y", `${-dy * influence * 0.65}px`);
      });
      if (remainder > 0.003 || scrollVelocity > 0.003)
        frame = requestAnimationFrame(render);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    // Late-streamed Suspense nodes can be observed before React brands them
    // (insertion fires the MutationObserver, branding does not). Writing
    // `dataset` before branding is a hydration mismatch, so unbranded nodes
    // are skipped and re-discovered once React owns them.
    let rediscoverTimer = 0;
    const retryDiscover = () => {
      if (rediscoverTimer) return;
      rediscoverTimer = window.setTimeout(() => {
        rediscoverTimer = 0;
        discover();
      }, 400);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const el = e.target as HTMLElement;
          if (!el.isConnected) return;
          if (!isHydrated(el)) {
            retryDiscover();
            return;
          }
          if (e.isIntersecting) {
            visible.add(el);
            el.dataset.inView = "true";
          } else visible.delete(el);
        });
        schedule();
      },
      { rootMargin: "40px" },
    );
    // Reveal stagger. Each revealing element takes its turn based on its
    // document-order position among the reveals that share its group, so a
    // grid of cards arrives as a wave instead of every card landing on one
    // frame. The group is the nearest ancestor holding at least two reveals,
    // which covers both `grid > .depth-card` (research, notes) and
    // `ol > li > .depth-card` (timeline milestones) markup. The step is capped
    // at 6 (~420ms) so a long archive still reads as a wave without leaving
    // its last row waiting on the first. Read by the CSS arrival keyframes via
    // --reveal-delay; each element is measured once, then latched.
    const REVEAL_STEP_MS = 70;
    const REVEAL_MAX_STEPS = 6;
    const revealGroup = (el: HTMLElement): HTMLElement | null => {
      let node = el.parentElement;
      for (let depth = 0; node && node !== root && depth < 4; depth++) {
        if (node.querySelectorAll("[data-reveal]").length > 1) return node;
        node = node.parentElement;
      }
      return null;
    };
    const setRevealDelay = (el: HTMLElement) => {
      if (el.dataset.revealStaggered === "true") return;
      el.dataset.revealStaggered = "true";
      const group = revealGroup(el);
      if (!group) return;
      let order = 0;
      for (const peer of group.querySelectorAll("[data-reveal]")) {
        if (peer === el) break;
        order++;
      }
      if (order > 0)
        write(
          el,
          "--reveal-delay",
          String(Math.min(order, REVEAL_MAX_STEPS) * REVEAL_STEP_MS),
        );
    };
    const discover = () => {
      seen.forEach((el) => {
        if (!el.isConnected) {
          seen.delete(el);
          visible.delete(el);
          observer.unobserve(el);
        }
      });
      root
        .querySelectorAll<HTMLElement>("[data-depth],[data-reveal]")
        .forEach((el) => {
          if (!seen.has(el)) {
            seen.add(el);
            observer.observe(el);
          }
          if (el.hasAttribute("data-reveal")) {
            if (!isHydrated(el)) retryDiscover();
            else setRevealDelay(el);
          }
        });
      root
        .querySelectorAll<HTMLElement>("[data-field-node]")
        .forEach((el) => {
          if (el.isConnected) fieldNodes.add(el);
        });
      fieldNodes.forEach((el) => {
        if (!el.isConnected) fieldNodes.delete(el);
      });
    };
    discover();
    const mutation = new MutationObserver(discover);
    mutation.observe(root, { childList: true, subtree: true });
    const unsubscribe = subscribeInteraction(schedule);
    schedule();
    return () => {
      unsubscribe();
      cancelAnimationFrame(frame);
      if (rediscoverTimer) window.clearTimeout(rediscoverTimer);
      observer.disconnect();
      mutation.disconnect();
      fieldNodes.clear();
      reset();
    };
  }, [allowed, path, ready]);
  return null;
}
