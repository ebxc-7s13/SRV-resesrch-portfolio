// Shared by the early server-rendered bootstrap and client-side controls.
export const ACCENT_COLORS = ["green", "blue", "red"] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];
export const ACCENT_STORAGE_KEY = "accent-color";

export const ACCENT_PALETTES = {
  green: { label: "Neon green", text: [183, 255, 74], fill: [183, 255, 74], onFill: [12, 18, 6], onLight: [22, 101, 52], secondary: 0x7de7ff },
  blue: { label: "Royal blue", text: [111, 160, 255], fill: [47, 85, 245], onFill: [255, 255, 255], onLight: [25, 53, 145], secondary: 0x99c8ff },
  red: { label: "Neon red", text: [255, 115, 121], fill: [218, 30, 52], onFill: [255, 255, 255], onLight: [130, 24, 43], secondary: 0xffb4a2 },
} as const;

export function isAccentColor(value: unknown): value is AccentColor {
  return value === "green" || value === "blue" || value === "red";
}

// Run before the body paints; no React/client bundle is needed to restore it.
export const ACCENT_BOOTSTRAP_SCRIPT = `(function(){var c='green';try{var s=localStorage.getItem('${ACCENT_STORAGE_KEY}');if(s==='green'||s==='blue'||s==='red')c=s;}catch(e){}document.documentElement.dataset.accent=c;})();`;
