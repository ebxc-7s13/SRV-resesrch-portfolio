"use client";
import { useEffect, useState } from "react";
import {
  BACKGROUND_MODES,
  setBackgroundMode,
  useBackgroundMode,
  type BackgroundMode,
} from "@/lib/background-mode";

export default function ThemeToggle({
  appearanceOnly = false,
}: {
  appearanceOnly?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const backgroundMode = useBackgroundMode();
  const modeOrder = BACKGROUND_MODES;
  const nextBackgroundMode: BackgroundMode =
    modeOrder[(modeOrder.indexOf(backgroundMode) + 1) % modeOrder.length];
  const modeLabel =
    backgroundMode[0].toUpperCase() + backgroundMode.slice(1);
  const nextLabel =
    nextBackgroundMode[0].toUpperCase() + nextBackgroundMode.slice(1);
  const backgroundLabel = `${modeLabel} background is on — switch to ${nextLabel}`;

  // The dock floats over content, so it yields while the user reads or
  // types: hidden on scroll-down and while a form field has focus, shown
  // on scroll-up and whenever focus is inside the dock itself.
  const [dockHidden, setDockHidden] = useState(false);
  useEffect(() => {
    if (!mounted) return;
    let lastY = window.scrollY;
    let fieldFocused = false;
    let dockFocused = false;
    const sync = () => {
      const scrolledDown = window.scrollY > lastY + 4 && window.scrollY > 120;
      if (window.scrollY <= 120) lastY = window.scrollY;
      else if (Math.abs(window.scrollY - lastY) > 4) lastY = window.scrollY;
      setDockHidden(
        (scrolledDown && !dockFocused) || (fieldFocused && !dockFocused),
      );
    };
    const onScroll = () => sync();
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      dockFocused = !!el?.closest?.(".theme-dock");
      fieldFocused = !!el?.closest?.("input,textarea,select");
      sync();
    };
    const onFocusOut = () => {
      fieldFocused = false;
      dockFocused = false;
      sync();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [mounted]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // The theme is fixed (night) and motion is always on: the only control is
  // the background toggle. The Lab owns its lighting, so no dock there.
  if (!mounted || appearanceOnly) return null;

  return (
    <div
      className={`theme-dock${dockHidden ? " is-hidden" : ""}`}
      role="group"
      aria-label="Background"
    >
      {/* Single toggle: one button cycles the five backgrounds.
          aria-pressed carries the non-default state; the label always says
          what is on and what it switches to. */}
      <button
        type="button"
        className="dock-segment"
        aria-pressed={backgroundMode !== "cells"}
        aria-label={backgroundLabel}
        title={backgroundLabel}
        onClick={() => setBackgroundMode(nextBackgroundMode)}
      >
        {modeLabel}
      </button>
    </div>
  );
}
