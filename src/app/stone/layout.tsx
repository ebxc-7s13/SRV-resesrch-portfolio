import type { Metadata } from "next";
import { Cinzel, EB_Garamond } from "next/font/google";
import "./stone.css";

// Stone Mode's own faces load only on /stone routes: lapidary capitals for
// inscriptions, an old-style serif for reading.
const display = Cinzel({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const text = EB_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], display: "swap" });

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
          __html: `:root[data-stone]{--stone-font-display:${display.style.fontFamily};--stone-font-text:${text.style.fontFamily};}`,
        }}
      />
      {children}
    </>
  );
}
