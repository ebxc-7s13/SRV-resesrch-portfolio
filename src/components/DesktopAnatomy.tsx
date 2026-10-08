"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

const XrayHero = dynamic(() => import("./xray/XrayHero"), { ssr: false });
const DESKTOP_QUERY = "(min-width: 901px)";

function subscribe(callback: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function desktopSnapshot() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function serverSnapshot() {
  return false;
}

export default function DesktopAnatomy() {
  const desktop = useSyncExternalStore(subscribe, desktopSnapshot, serverSnapshot);
  // Omit the entire mobile section, including its renderer and asset requests.
  if (!desktop) return null;
  return (
    <section className="home-anatomy shell" aria-label="Interactive anatomical scan">
      <XrayHero />
    </section>
  );
}
