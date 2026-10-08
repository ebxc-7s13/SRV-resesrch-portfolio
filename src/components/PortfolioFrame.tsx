"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import CursorField from "./background/CursorField";
import CursorTrail from "./background/CursorTrail";
import Navigation from "./Navigation";
import Footer from "./Footer";
import Marquee from "./Marquee";
import BackgroundSystem from "./background/BackgroundSystem";
import MotionEffects from "./MotionEffects";
import { Reveal } from "./Reveal";
import { setBackgroundMode, useBackgroundMode } from "@/lib/background-mode";

// The optional WebGL layers (vanta/three, threejs-components) only download
// when their mode is actually selected.
const VantaCellsLayer = dynamic(
  () => import("./background/VantaCells"),
  { ssr: false, loading: () => null },
);

const LiquidMouseLayer = dynamic(
  () => import("./background/LiquidMouse"),
  { ssr: false, loading: () => null },
);

export default function PortfolioFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  // Read the mode store before any early return so hook order stays stable.
  // This is what lets the optional WebGL layers only enter the tree (and
  // trigger their dynamic chunks) when the user actually picks them.
  const backgroundMode = useBackgroundMode();
  useEffect(() => {
    document.documentElement.dataset.bgmode = backgroundMode;
    return () => { delete document.documentElement.dataset.bgmode; };
  }, [backgroundMode, path]);
  const isPlayRoute = path === "/play";
  useEffect(() => {
    if (isPlayRoute) setBackgroundMode("liquid");
  }, [isPlayRoute]);
  // The lab owns its lighting, header and motion controls. Other routes retain
  // the original frame and do not mount a WebGL renderer.
  // The lab flag also lets lab.css lift the cursor-field canvas above the
  // lab's opaque page surface (it sits at z -1 everywhere else).
  const isLabRoute = path === "/lab" || path === "/lab/models";
  useEffect(() => {
    if (isLabRoute) document.documentElement.dataset.labRoute = "true";
    else delete document.documentElement.dataset.labRoute;
    return () => {
      delete document.documentElement.dataset.labRoute;
    };
  }, [isLabRoute]);
  // Full page loads (first visit and reloads) always start on the hero:
  // browsers otherwise restore the pre-reload scroll position. Runs once
  // per full load — client-side route changes never remount the frame, so
  // in-app navigation and back/forward are untouched. Deep links are
  // skipped so #anchor URLs still land on their section.
  useEffect(() => {
    if (window.location.hash) return;
    try {
      window.history.scrollRestoration = "manual";
    } catch {
      /* older browsers ignore scrollRestoration */
    }
    window.scrollTo(0, 0);
  }, []);
  if (isLabRoute)
    return (
      <div id="main-content" tabIndex={-1}>
        {/* The cursor field is site-wide: it runs on the lab's native dark
            surface too (the lab owns its lighting, not its cursor). */}
        <CursorField />
        <CursorTrail />
        {children}
      </div>
    );
  const isAdmin = path.startsWith("/admin");
  return (
    <div
      className={isAdmin ? "legacy-frame" : "portfolio-shell"}
      data-route={path.split("/")[1] || "home"}
    >
      {/* Site-wide cursor treatment: the magnetic field replaces the old
          white mouse glow on every route and every background mode, and the
          trail adds the short neon fade-out behind the native cursor head. */}
      {!isPlayRoute && <CursorField />}
      {!isPlayRoute && <CursorTrail />}
      {!isPlayRoute && <MotionEffects />}
      {!isAdmin && !isPlayRoute && <BackgroundSystem />}
      {!isAdmin && !isPlayRoute && backgroundMode === "cells" && <VantaCellsLayer />}
      {!isAdmin && (isPlayRoute || backgroundMode === "liquid") && <LiquidMouseLayer />}
      {!isPlayRoute && <Marquee direction="left" sticky />}
      <Navigation playMode={isPlayRoute} />
      {isPlayRoute ? children : <div className="pt-16 relative" id="main-content" tabIndex={-1}>
        <div key={path} className="route-view">
          {children}
        </div>
        <Reveal>
          <Footer />
        </Reveal>
      </div>}
      {!isPlayRoute && <Marquee direction="right" />}
    </div>
  );
}
