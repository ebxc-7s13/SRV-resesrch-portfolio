import type { Metadata } from "next";
import localFont from "next/font/local";
import "./stone.css";
import "./stone-architecture.css";

// Stone Mode's own faces load only on /stone routes: lapidary capitals for
// inscriptions, an old-style serif for reading. Self-hosted (SIL OFL 1.1,
// licences in ./fonts) so builds never depend on fetching Google Fonts.
const stoneInscription = localFont({
  src: "./fonts/cinzel-latin.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  fallback: ["Trajan Pro", "Georgia", "serif"],
});
const stoneReading = localFont({
  src: [
    { path: "./fonts/eb-garamond-latin.woff2", weight: "400 600", style: "normal" },
    { path: "./fonts/eb-garamond-italic-latin.woff2", weight: "400 600", style: "italic" },
  ],
  display: "swap",
  fallback: ["Garamond", "Georgia", "serif"],
});

export const metadata: Metadata = {
  // The original pages are canonical; the stone variants are an experience.
  robots: { index: false, follow: true },
};

export default function StoneLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Font families are exposed on :root so the navigation and footer,
          which render outside this layout, use them too. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `:root[data-stone]{--stone-font-display:${stoneInscription.style.fontFamily};--stone-font-text:${stoneReading.style.fontFamily};}`,
        }}
      />
      {children}
    </>
  );
}
