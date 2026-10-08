import type { Metadata, Viewport } from "next";
import { SiteContentProvider } from "@/components/SiteContent";
import { getSiteContent } from "@/lib/site-content";
import PortfolioFrame from "@/components/PortfolioFrame";
import OffscreenPause from "@/components/OffscreenPause";
import {
  Space_Grotesk,
  JetBrains_Mono,
  Orbitron,
  Michroma,
} from "next/font/google";
import { GeistPixelSquare } from "geist/font/pixel";
import "./globals.css";
import "./design-system.css";
import "./interaction-system.css";
import "./galaxy-button.css";
import "./shuffle-text.css";
import "./background-system.css";
import "./hero-industrial.css";
import "./hero-gallery.css";
import "@/styles/text-animations.scss";
import "@/styles/ui-polish.scss";
import "./responsive-layout.css";

// Supported CMS text must refresh on every public page, including Contact.
export const dynamic = "force-dynamic";

// Phone platform layer: paint edge-to-edge under the notch and match the
// browser chrome to the page. The site is dark-only, so one dark theme-color.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#070809",
};

const displayFont = Michroma({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "400",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["400", "500", "600", "700"],
  // Swap on every face: text paints in the fallback immediately instead of
  // being invisible while each family loads (font-display contract).
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500", "700"],
  display: "swap",
});
// Sci-fi display voice for the hero role marquee. The alt voice reuses
// --font-display (Michroma) instead of loading a second identical font.
// Below-the-fold/marquee-only face: no preload, so it never competes with
// the LCP fonts; display=swap keeps the same pixels once it arrives.
const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-scifi",
  weight: ["500", "700", "900"],
  display: "swap",
  preload: false,
});
// Geist Pixel (Vercel, official `geist` package): display face for content
// record titles — publications, patents, theses, projects, notes.
const geistPixel = GeistPixelSquare;

export const metadata: Metadata = {
  ...(process.env.NEXT_PUBLIC_SITE_URL
    ? { metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL) }
    : {}),
  title: {
    default: "Raja Viveka Vardhan Siluveru — Biomedical Engineering Researcher",
    template: "%s | Raja Viveka Vardhan Siluveru",
  },
  alternates: { canonical: "/" },
  description:
    "Biomedical Engineering Researcher developing label-free imaging systems, computational methods, and AI-based diagnostic tools for early disease detection. Research in autofluorescence imaging, deep learning, and non-invasive diagnostics.",
  keywords: [
    "biomedical engineering",
    "oral cancer detection",
    "autofluorescence imaging",
    "deep learning",
    "label-free diagnostics",
    "optical imaging",
    "non-invasive diagnostics",
    "medical instrumentation",
    "computational pathology",
    "microgravity simulation",
    "FASCANet",
    "AFiS-Net",
  ],
  authors: [{ name: "Raja Viveka Vardhan Siluveru" }],
  creator: "Raja Viveka Vardhan Siluveru",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Raja Viveka Vardhan Siluveru — Research Portfolio",
    title: "Raja Viveka Vardhan Siluveru — Biomedical Engineering Researcher",
    description:
      "Label-free imaging systems, computational methods, and AI diagnostics for early disease detection.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Raja Viveka Vardhan Siluveru — Biomedical Engineering Researcher",
    description:
      "Label-free imaging systems, computational methods, and AI diagnostics for early disease detection.",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const content = await getSiteContent().catch(() => ({}));
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{document.documentElement.dataset.theme='night';try{localStorage.setItem('theme','night');localStorage.removeItem('daynight');localStorage.removeItem('motion-preference');}catch(e){}document.documentElement.dataset.motion='active';}catch(e){}})();`,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${spaceGrotesk.variable} ${jetbrains.variable} ${displayFont.variable} ${orbitron.variable} ${geistPixel.variable} font-sans antialiased`}
      >
        <OffscreenPause />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <SiteContentProvider values={content}>
          <PortfolioFrame>{children}</PortfolioFrame>
        </SiteContentProvider>
      </body>
    </html>
  );
}
