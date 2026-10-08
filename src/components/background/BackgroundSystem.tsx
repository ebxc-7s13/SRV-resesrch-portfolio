"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_TUNING,
  applyBatteryConstraint,
  detectQuality,
  parseTuning,
  prefersLightweightBackground,
  routeProfile,
  type BackgroundQuality,
  type BackgroundTheme,
  type FluidTuning,
} from "./presets";
import { useAmbientTuning } from "@/lib/ambient-tuning";
import { useBackgroundMode } from "@/lib/background-mode";

const FluidCanvas = dynamic(() => import("./FluidCanvas"), {
  ssr: false,
  loading: () => null,
});

function developmentQuality(): BackgroundQuality | null {
  if (process.env.NODE_ENV !== "development") return null;
  try {
    const quality = new URLSearchParams(window.location.search).get("bg");
    return quality === "low" || quality === "medium" || quality === "high"
      ? quality
      : null;
  } catch {
    return null;
  }
}

function developmentTuning(): FluidTuning | undefined {
  if (process.env.NODE_ENV !== "development") return undefined;
  try {
    const params = new URLSearchParams(window.location.search);
    const keys = [
      "bgflow",
      "bgwarp",
      "bgscale",
      "bgmouse",
      "bgfil",
      "bgtrail",
      "bgcontrast",
      "bgbright",
      "bgparticles",
    ];
    return keys.some((key) => params.has(key)) ? parseTuning() : undefined;
  } catch {
    return undefined;
  }
}

function useBackgroundPreferences() {
  const [active, setActive] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(media.matches);
      setActive(
        !document.hidden &&
          document.documentElement.dataset.motion !== "paused",
      );
    };
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("portfolio-motion", update);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("portfolio-motion", update);
    };
  }, []);

  return { active, reduced };
}

export default function BackgroundSystem() {
  const path = usePathname();
  const { active, reduced } = useBackgroundPreferences();
  const [initialized, setInitialized] = useState(false);
  const [failed, setFailed] = useState(false);
  const [labOccluded, setLabOccluded] = useState(false);
  const [theme, setTheme] = useState<BackgroundTheme>("night");
  const [quality, setQuality] = useState<BackgroundQuality>("medium");
  // Constrained devices still get live Ambient, with fewer strands and frames.
  const [lightweight, setLightweight] = useState(false);
  const profile = useMemo(() => routeProfile(path), [path]);
  // User tuning from the environment popup (neutral 1s = shipped look).
  // Development URL params (?bgflow= ?bgwarp= ?bgscale= ?bgbright=) still
  // override on top when present.
  const stored = useAmbientTuning();
  const tuning = useMemo<FluidTuning>(() => {
    const merged: FluidTuning = {
      ...DEFAULT_TUNING,
      flow: stored.speed,
      bright: stored.brightness,
      warp: stored.warp,
      scale: stored.scale,
    };
    if (process.env.NODE_ENV !== "development") return merged;
    try {
      const params = new URLSearchParams(window.location.search);
      const dev = developmentTuning();
      if (!dev) return merged;
      if (params.has("bgflow")) merged.flow = dev.flow;
      if (params.has("bgwarp")) merged.warp = dev.warp;
      if (params.has("bgscale")) merged.scale = dev.scale;
      if (params.has("bgbright")) merged.bright = dev.bright;
    } catch {
      /* URL unavailable â€” stored tuning still applies */
    }
    return merged;
  }, [stored]);
  const mode = useBackgroundMode();
  // Cells mode owns the background plane: unmount the ambient canvas so
  // only one animated background ever runs.
  // Same when the home lab exhibit (#lab) covers the viewport: the lab stage
  // is opaque, so the fluid field behind it is invisible â€” suspend it to
  // leave rendering time to the lab while Ambient is invisible.
  const fluidActive =
    mode === "ambient" &&
    active &&
    initialized &&
    !failed &&
    !labOccluded;
  const effectiveQuality = reduced || lightweight ? "low" : quality;

  useEffect(() => {
    const sync = () => setTheme("night");
    sync();
    window.addEventListener("portfolio-theme", sync);
    return () => window.removeEventListener("portfolio-theme", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLightweight(prefersLightweightBackground());
    const selected = developmentQuality() || detectQuality();
    setQuality(selected);
    void applyBatteryConstraint(selected).then((constrained) => {
      if (!cancelled && !developmentQuality()) setQuality(constrained);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The CSS fallback paints first. Ambient starts after the browser has had
  // a chance to settle the foreground, keeping the background out of LCP.
  // Suspend the fluid field while the opaque home lab exhibit covers the
  // viewport (re-mounted on scroll back). Routes without #lab never occlude.
  useEffect(() => {
    // A route can change while the home exhibit is still intersecting. Its
    // observer is disconnected below, so clear that route's occlusion first.
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
  useEffect(() => {
    if (!active || initialized) return;
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleHandle = 0;
    let timeoutHandle = 0;
    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(
        () => setInitialized(true),
        { timeout: 500 },
      );
    } else {
      timeoutHandle = window.setTimeout(() => setInitialized(true), 120);
    }
    return () => {
      if (idleHandle) idleWindow.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
    };
  }, [active, initialized]);

  useEffect(() => {
    document.documentElement.dataset.bgQuality = effectiveQuality;
    document.documentElement.dataset.bgfluid = "on";
  }, [effectiveQuality]);

  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.bgQuality;
    };
  }, []);

  const handleReady = useCallback(() => {
    setFailed(false);
    document.documentElement.dataset.bgfluid = "on";
  }, []);
  const handleFailure = useCallback(() => {
    setFailed(true);
    document.documentElement.dataset.bgfluid = "off";
  }, []);

  return (
    <div
      className="background-system"
      data-failed={failed ? "true" : undefined}
      data-quality={effectiveQuality}
      data-reduced={reduced ? "true" : undefined}
      aria-hidden="true"
    >
      <div className="background-fallback" />
      {fluidActive && (
        <FluidCanvas
          theme={theme}
          quality={effectiveQuality}
          profile={profile}
          reduced={reduced}
          tuning={tuning}
          onReady={handleReady}
          onFailure={handleFailure}
        />
      )}
    </div>
  );
}
