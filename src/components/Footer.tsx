import FooterLogo from "./FooterLogo";
import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="site-footer relative z-10 border-t-2 border-green-950/30"
      style={{ backgroundColor: "#B7FF4A" }}
    >
      <div className="footer-inner max-w-7xl mx-auto px-6 py-5">
        <div className="footer-main flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Brand */}
          <div className="footer-brand flex items-center gap-4">
            <FooterLogo />
            <div>
              <span className="footer-name font-bold text-green-950 text-2xl md:text-4xl tracking-tight leading-tight">
                <span className="block">
                  <em>Siluveru</em> Raja
                </span>
                <span className="block">Viveka Vardhan</span>
              </span>
              <p className="mt-1 text-xs md:text-sm font-mono text-green-950/80 tracking-wide">
                BTech-MTech-PhD in Biomedical Engineering
              </p>
            </div>
          </div>

          <ul className="footer-links grid grid-cols-2 md:grid-cols-4 gap-1.5 md:justify-end">
              <li>
                <Link
                  href="/research"
                  className="footer-chip inline-flex items-center gap-1.5 px-3 py-1.5 text-base text-green-950 hover:text-black transition-colors font-mono"
                >
                  → Projects
                </Link>
              </li>
              <li>
                <Link
                  href="/publications"
                  className="footer-chip inline-flex items-center gap-1.5 px-3 py-1.5 text-base text-green-950 hover:text-black transition-colors font-mono"
                >
                  → Papers
                </Link>
              </li>
              <li>
                <Link
                  href="/thesis"
                  className="footer-chip inline-flex items-center gap-1.5 px-3 py-1.5 text-base text-green-950 hover:text-black transition-colors font-mono"
                >
                  → Theses
                </Link>
              </li>
              <li>
                <Link
                  href="/patents"
                  className="footer-chip inline-flex items-center gap-1.5 px-3 py-1.5 text-base text-green-950 hover:text-black transition-colors font-mono"
                >
                  → Patents
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="footer-chip inline-flex items-center gap-1.5 px-3 py-1.5 text-base text-green-950 hover:text-black transition-colors font-mono"
                >
                  → About
                </Link>
              </li>
              <li>
                <Link
                  href="/timeline"
                  className="footer-chip inline-flex items-center gap-1.5 px-3 py-1.5 text-base text-green-950 hover:text-black transition-colors font-mono"
                >
                  → Timeline
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="footer-chip inline-flex items-center gap-1.5 px-3 py-1.5 text-base text-green-950 hover:text-black transition-colors font-mono"
                >
                  → Notes
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="footer-chip inline-flex items-center gap-1.5 px-3 py-1.5 text-base text-green-950 hover:text-black transition-colors font-mono"
                >
                  → Contact
                </Link>
              </li>
            </ul>
        </div>

        <div className="footer-legal mt-5 pt-4 border-t border-green-950/30 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-sm md:text-base text-green-950 font-sans font-extrabold uppercase tracking-brutal">
            © {new Date().getFullYear()} Siluveru R. V. — All rights reserved
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="text-sm md:text-base text-green-950 hover:text-black transition-colors font-sans font-extrabold"
            >
              Privacy
            </Link>
            <span className="text-green-950/70 text-base">|</span>
            <Link
              href="/terms"
              className="text-sm md:text-base text-green-950 hover:text-black transition-colors font-sans font-extrabold"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
