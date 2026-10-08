"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import GalaxyButton from "./GalaxyButton";
import type { LabContent } from "@/lib/lab-devices";

const LabExperience = dynamic(() => import("@/components/lab/LabExperience"), {
  ssr: false,
  loading: () => (
    <div className="home-lab-loading" role="status" aria-label="Loading laboratory">
      <span className="lab-spinner" aria-hidden="true" />
      Preparing the laboratory exhibit…
    </div>
  ),
});

/**
 * HomeLabSection — the immersive laboratory exhibit embedded in Home.
 * Hero → transition → lab → featured research continues.
 * No route change, no scroll hijack, no WebGL required for research access.
 */
export default function HomeLabSection({ content }: { content: LabContent }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const passageRef = useRef<HTMLDivElement>(null);
  // The lab exhibit (R3F + GLB loaders) is heavy: defer its chunk until the
  // section approaches the viewport so Home's first paint stays light. The
  // heading/passage markup below renders immediately either way.
  const [labEligible, setLabEligible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const passage = passageRef.current;
    if (!section || !passage) return;

    // Reveal the exhibit once it approaches; drives the mask/perspective
    // transition via CSS vars only (no re-render per frame).
    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      // 0 = far below, 1 = section top reached viewport center
      const progress = Math.min(
        1,
        Math.max(0, 1 - rect.top / (vh * 0.85)),
      );
      passage.style.setProperty("--lab-enter", progress.toFixed(3));
      if (rect.top < vh * 0.75) section.setAttribute("data-active", "true");
      // Arm the heavy exhibit one-and-a-half viewports out — the earliest a
      // visitor could plausibly reach it, and never during initial load.
      if (stageRef.current && stageRef.current.getBoundingClientRect().top < vh * 1.5)
        setLabEligible(true);
    };
    let ticking = false;
    const onScrollRaf = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScrollRaf, { passive: true });
    window.addEventListener("resize", onScrollRaf);
    return () => {
      window.removeEventListener("scroll", onScrollRaf);
      window.removeEventListener("resize", onScrollRaf);
    };
  }, []);

  // Heavy-lab strategy (two independent gates):
  // 1. MOUNT (React render + WebGL init + GLB decode) only when the exhibit
  //    actually approaches the viewport — handled by the scroll effect above
  //    flipping `labEligible` at 1.5 viewports out.
  // 2. NETWORK warm of the chunk bytes on true idle, with no timeout: it only
  //    fires when the main thread is genuinely quiet, so it never competes
  //    with load or interaction (and never fires under synthetic throttling).
  useEffect(() => {
    if (labEligible) return;
    let cancelled = false;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const prefetch = () => {
      if (cancelled) return;
      const preload = (
        LabExperience as unknown as { preload?: () => Promise<unknown> }
      ).preload;
      void preload?.().catch(() => {});
    };
    const handle =
      idleWindow.requestIdleCallback?.(prefetch) ??
      window.setTimeout(prefetch, 3000);
    return () => {
      cancelled = true;
      if (idleWindow.cancelIdleCallback && typeof handle === "number") {
        idleWindow.cancelIdleCallback(handle);
      } else {
        window.clearTimeout(handle as unknown as number);
      }
    };
  }, [labEligible]);

  return (
    <section
      ref={sectionRef}
      id="lab"
      className="home-lab-exhibit"
      aria-label="Digital research laboratory — interactive exhibit"
    >
      {/* Passage: identity → world. Purely presentational. */}
      <div ref={passageRef} className="home-lab-passage" aria-hidden="true">
        <div className="home-lab-passage-grid" />
        <div className="home-lab-passage-mask" />
        <div className="home-lab-passage-line">
          <span />
          <em>FROM IDENTITY INTO THE RESEARCH WORLD</em>
          <span />
        </div>
      </div>

      <div className="home-lab-heading shell">
        <div className="eyebrow">
          <span className="signal-dot" aria-hidden="true" />
          Home / Interactive exhibit
        </div>
        <h2 data-reveal>
          Digital research
          <br />
          laboratory<span aria-hidden="true">.</span>
        </h2>
        <p className="text-shimmer">
          Step from the researcher&apos;s identity into their research world.
          Inspect the real microscope and microgravity simulator, browse the
          project, publication and patent archives, and continue into the full
          portfolio below — all without leaving Home.
        </p>
        <div className="home-lab-meta">
          <span>01 / Biomedical imaging</span>
          <span>02 / Microgravity engineering</span>
          <span>03 / AI workstation</span>
          <span>04 / Archives</span>
        </div>
      </div>

      <div ref={stageRef} className="home-lab-stage shell">
        {labEligible ? (
          <LabExperience content={content} />
        ) : (
          <div
            className="home-lab-loading"
            role="status"
            aria-label="Preparing laboratory"
            style={{ minHeight: "420px" }}
          >
            <span className="lab-spinner" aria-hidden="true" />
            Preparing the laboratory exhibit…
          </div>
        )}
      </div>

      <div className="home-lab-after shell">
        <GalaxyButton
          href="#featured-research"
          seed={5}
          radius="7px"
          className="home-lab-continue"
        >
          Continue to featured research <span aria-hidden="true">↓</span>
        </GalaxyButton>
        <span className="home-lab-hint">
          Tip: use the guided tour inside the exhibit, or select any station.
          Esc returns to the page.
        </span>
      </div>
    </section>
  );
}
