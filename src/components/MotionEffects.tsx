"use client";
import dynamic from "next/dynamic";
const MotionEngine = dynamic(() => import("./MotionEngine"), { ssr: false });
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Motion is always on: the pause/play control was removed by design. The
// OS-level prefers-reduced-motion and tab-visibility still gate the engine,
// and html[data-motion-running] drives the CSS side.
export function useMotionAllowed() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setAllowed(!document.hidden && !media.matches);
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return allowed;
}

export default function MotionEffects() {
  const path = usePathname(),
    allowed = useMotionAllowed();
  useEffect(() => {
    document.documentElement.dataset.motionRunning = String(allowed);
  }, [allowed]);
  return allowed ? <MotionEngine allowed={allowed} path={path} /> : null;
}
