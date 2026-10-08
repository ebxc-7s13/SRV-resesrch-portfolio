"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isTechnicalBackground, useBackgroundMode } from "@/lib/background-mode";

// Technical geometry and shaders download only when one of their modes is
// selected. The chosen scene owns exactly one renderer and frame loop.
const TechnicalCanvas = dynamic(() => import("./TechnicalCanvas"), { ssr: false });

export default function BackgroundSystem() {
  const mode = useBackgroundMode();
  const path = usePathname();
  const [labOccluded, setLabOccluded] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    // Clear the previous route's occlusion before observing the current one.
    setLabOccluded(false);
    const lab = document.getElementById("lab");
    if (!lab) return;
    const observer = new IntersectionObserver(
      ([entry]) => setLabOccluded(entry.isIntersecting),
      { threshold: 0.12 },
    );
    observer.observe(lab);
    return () => observer.disconnect();
  }, [path]);

  if (!isTechnicalBackground(mode)) return null;
  return <TechnicalCanvas key={mode} mode={mode} active={!labOccluded} reduced={reduced} />;
}
