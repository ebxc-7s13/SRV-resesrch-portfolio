"use client";

import { cycleAccentColor, useAccentColor } from "@/lib/accent-color";
import { ACCENT_COLORS, ACCENT_PALETTES } from "@/lib/accent-palette";

export default function AccentColorControl() {
  const color = useAccentColor();
  const next = ACCENT_COLORS[(ACCENT_COLORS.indexOf(color) + 1) % ACCENT_COLORS.length];
  const label = `Color theme: ${ACCENT_PALETTES[color].label}. Switch to ${ACCENT_PALETTES[next].label}.`;
  return (
    <button type="button" className="accent-color-control" data-pointer
      aria-label={label} title={label} onClick={cycleAccentColor}>
      <span className="accent-color-dot" aria-hidden="true" />
      <span className="sr-only" role="status" aria-live="polite">{ACCENT_PALETTES[color].label} color theme</span>
    </button>
  );
}
