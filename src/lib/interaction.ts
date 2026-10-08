"use client";
export type Interaction = {
  x: number;
  y: number;
  nx: number;
  ny: number;
  velocity: number;
  pointerTime: number;
  pointerType: "mouse" | "touch" | "pen" | "none";
  scroll: number;
  scrollVelocity: number;
  scrollTime: number;
  progress: number;
  hover: boolean;
  target: Element | null;
  inside: boolean;
  click: number;
};
export const interaction: Interaction = {
  x: -100,
  y: -100,
  nx: 0,
  ny: 0,
  velocity: 0,
  pointerTime: 0,
  pointerType: "none",
  scroll: 0,
  scrollVelocity: 0,
  scrollTime: 0,
  progress: 0,
  hover: false,
  target: null,
  inside: false,
  click: 0,
};
const subscribers = new Set<(state: Interaction) => void>();
let cleanup: (() => void) | undefined;
// One shared input source; consumers update refs/CSS without React renders per frame.
export function subscribeInteraction(listener: (state: Interaction) => void) {
  subscribers.add(listener);
  if (!cleanup && typeof window !== "undefined") {
    let frame = 0,
      lastTime = performance.now(),
      lastScroll = window.scrollY,
      lastScrollTime = lastTime;
    const emit = () => {
      frame = 0;
      subscribers.forEach((fn) => fn(interaction));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(emit);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const now = performance.now(),
        dt = Math.max(8, now - lastTime);
      interaction.velocity = interaction.inside
        ? Math.min(
            3,
            Math.hypot(
              event.clientX - interaction.x,
              event.clientY - interaction.y,
            ) / dt,
          )
        : 0;
      interaction.x = event.clientX;
      interaction.y = event.clientY;
      interaction.nx = event.clientX / window.innerWidth - 0.5;
      interaction.ny = event.clientY / window.innerHeight - 0.5;
      interaction.target =
        event.target instanceof Element ? event.target : null;
      interaction.hover = !!interaction.target?.closest(
        "a,button,summary,[data-depth],video",
      );
      interaction.inside = true;
      interaction.pointerTime = now;
      interaction.pointerType = "mouse";
      lastTime = now;
      schedule();
    };
    const scroll = () => {
      const now = performance.now();
      const y = window.scrollY;
      const dt = Math.max(8, now - lastScrollTime);
      interaction.scrollVelocity = Math.max(
        -1,
        Math.min(1, ((y - lastScroll) / dt) * 0.18),
      );
      interaction.scroll = y;
      interaction.scrollTime = now;
      lastScroll = y;
      lastScrollTime = now;
      interaction.progress =
        y / Math.max(1, document.documentElement.scrollHeight - innerHeight);
      schedule();
    };
    const resize = () => {
      interaction.scroll = window.scrollY;
      interaction.progress =
        interaction.scroll /
        Math.max(1, document.documentElement.scrollHeight - innerHeight);
      schedule();
    };
    const leave = () => {
      interaction.inside = false;
      interaction.velocity = 0;
      interaction.pointerType = "none";
      schedule();
    };
    // Presses are captured for every pointer type. A tap is a real input
    // signal on touch, so it must reach consumers (the ambient ripple, press
    // acknowledgement) even though sustained movement stays mouse-only — that
    // keeps the frame loop off touch-scroll frames entirely.
    const press = (event: PointerEvent) => {
      const x = event.clientX;
      const y = event.clientY;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        interaction.x = x;
        interaction.y = y;
        interaction.nx = x / window.innerWidth - 0.5;
        interaction.ny = y / window.innerHeight - 0.5;
      }
      interaction.pointerType =
        event.pointerType === "mouse"
          ? "mouse"
          : event.pointerType === "touch"
            ? "touch"
            : "pen";
      interaction.click = performance.now();
      schedule();
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointerdown", press, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    scroll();
    cleanup = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", press);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
    };
  }
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) {
      cleanup?.();
      cleanup = undefined;
    }
  };
}
