"use client";

import { useEffect, useRef, useState } from "react";
import type { TechnicalBackgroundMode } from "@/lib/background-mode";
import { useTechnicalTuning } from "@/lib/technical-tuning";
import { createTechnicalBackground } from "./technical/createTechnicalBackground";

export default function TechnicalCanvas({ mode, active, reduced }: {
  mode: TechnicalBackgroundMode; active: boolean; reduced: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ReturnType<typeof createTechnicalBackground> | null>(null);
  const [failed, setFailed] = useState(false);
  const tuning = useTechnicalTuning(mode);
  const latestTuning = useRef(tuning);
  latestTuning.current = tuning;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || failed) return;
    // A fresh canvas for every activation also survives React Strict Mode's
    // setup/cleanup/setup cycle after the old GPU context is released.
    const canvas = document.createElement("canvas");
    canvas.className = "technical-canvas";
    canvas.dataset.technicalCanvas = mode;
    host.appendChild(canvas);
    try {
      const engine = createTechnicalBackground(canvas, mode, latestTuning.current, reduced, () => setFailed(true));
      engineRef.current = engine;
      return () => { engineRef.current = null; engine.dispose(); canvas.remove(); };
    } catch (error) {
      if (process.env.NODE_ENV === "development") console.error(`Could not initialize ${mode} background`, error);
      canvas.remove();
      setFailed(true);
    }
  }, [mode, reduced, failed]);

  useEffect(() => { engineRef.current?.setTuning(tuning); }, [tuning, mode, reduced]);
  useEffect(() => { engineRef.current?.setActive(active); }, [active, mode, reduced]);

  return <div className="technical-layer" data-technical-mode={mode} data-failed={failed || undefined} aria-hidden="true">
    <div className="technical-fallback" />
    {!failed && <div ref={hostRef} className="technical-host"
      style={{ filter: `brightness(${tuning.brightness})` }} />}
    <div className="technical-shade" />
  </div>;
}
