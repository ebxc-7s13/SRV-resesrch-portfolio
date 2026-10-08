/* eslint-disable @next/next/no-html-link-for-pages -- A full document navigation applies the destination's CSP when leaving the Wasm-enabled lab. */
import type { Metadata } from "next";
import { getLabContent } from "@/lib/lab-content";
import LabExperience from "@/components/lab/LabExperience";
import "./lab.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Research Laboratory",
  description:
    "Explore the supplied microscope and microgravity simulator models, linked to their existing research records.",
  alternates: { canonical: "/lab" },
};
export default async function LaboratoryPage() {
  const content = await getLabContent();
  return (
    <main className="laboratory">
      <header className="lab-header">
        <a href="/" className="lab-brand">
          <span className="lab-monogram">
            sv<span>↗</span>
          </span>
          <span>
            SILUVERU<small>RESEARCH LABORATORY</small>
          </span>
        </a>
        <nav aria-label="Laboratory navigation">
          <a href="#research-devices">Devices</a>
          <a href="#lab-publications">Publications</a>
          <a href="/research">
            Research archive <span>↗</span>
          </a>
        </nav>
        <a className="lab-header-back" href="/">
          Portfolio ↗
        </a>
      </header>
      <LabExperience content={content} />
      <footer className="lab-footer">
        <a href="/">SILUVERU / RESEARCH LABORATORY</a>
        <span>Devices → Experiments → Research</span>
        <div>
          <a href="/contact">Contact ↗</a>
          <a href="/privacy">Privacy</a>
        </div>
      </footer>
    </main>
  );
}
