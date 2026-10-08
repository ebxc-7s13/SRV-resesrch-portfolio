"use client";

import { useEffect, useRef, useState } from "react";
import type { AnatomySystem, XraySceneController } from "./createXrayScene";
import styles from "./XrayHero.module.css";

const systems = [
  { key: "skeleton", label: "SKELETON", accessible: "Show skeleton" },
  { key: "muscles", label: "MUSCLES", accessible: "Show muscles" },
  { key: "nervous", label: "NERVES", accessible: "Show nervous system" },
] as const;

function AnatomyIcon({ system }: { system: AnatomySystem }) {
  return (
    <svg className={styles.systemIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {system === "skeleton" ? <>
        <path d="M8 17v3h8v-3l2-1a3 3 0 0 0 1.5-2.6V10a7.5 7.5 0 0 0-15 0v3.4A3 3 0 0 0 6 16z" />
        <circle cx="8.5" cy="11" r="1.5" />
        <circle cx="15.5" cy="11" r="1.5" />
        <path d="m11 15 1-2 1 2M10.5 17v3m3-3v3" />
      </> : system === "muscles" ? <>
        <path d="m7.4 8.5 1.7.6M10 18a5 5 0 0 0 6-5" />
        <path d="M4.5 8.5a3 3 0 0 1 4.2-3.9l.8.9.5-.4a2 2 0 0 1 2.8.1l.7.8a2 2 0 0 1 0 2.7L10 12" />
        <path d="m4.5 8.5-1.8 4.5a3.2 3.2 0 0 0 1.5 4l4.6 2.3a10 10 0 0 0 12.7-4.1 3.9 3.9 0 0 0-5.9-4.8" />
      </> : <>
        <path d="M12 5a3 3 0 0 0-5.8-1A4 4 0 0 0 3 10a4 4 0 0 0 .5 7 4 4 0 0 0 8.5 2V5Zm0 0a3 3 0 0 1 5.8-1A4 4 0 0 1 21 10a4 4 0 0 1-.5 7 4 4 0 0 1-8.5 2" />
        <path d="M6.2 4A3 3 0 0 0 7 7m10-3a3 3 0 0 1-1 3M3 10a3 3 0 0 1 3 1m15-1a3 3 0 0 0-3 1M7 14a3 3 0 0 1-3.5 3M17 14a3 3 0 0 0 3.5 3M8 18a3 3 0 0 1 4 1m4-1a3 3 0 0 0-4 1" />
      </>}
    </svg>
  );
}

export default function XrayHero() {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<XraySceneController | null>(null);
  const activeRef = useRef(false), motionRef = useRef(false), intent = useRef(false);
  const touchSelection = useRef(false);
  const tier = useRef<{ lowQuality: boolean; deferPreload: boolean } | null>(null);
  const [visible, setVisible] = useState(false), [foreground, setForeground] = useState(false);
  const [initialized, setInitialized] = useState(false), [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [zoomed, setZoomed] = useState(false);
  const [hovered, setHovered] = useState<AnatomySystem | null>(null), [focused, setFocused] = useState<AnatomySystem | null>(null), [pinned, setPinned] = useState<AnatomySystem | null>(null);
  const [loads, setLoads] = useState<Partial<Record<AnatomySystem, "loading" | "ready" | "error">>>({});
  const selected = focused ?? hovered ?? pinned ?? "skeleton";
  const isActive = visible && foreground && !failed;
  activeRef.current = isActive; motionRef.current = reduced;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const device = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    const sync = () => {
      // Pick one tier per mount. Resize never recreates a renderer or reloads packs.
      tier.current ??= { lowQuality: window.innerWidth < 1100 || (device.deviceMemory ?? 8) <= 4 || navigator.hardwareConcurrency <= 4 || !!device.connection?.saveData, deferPreload: !!device.connection?.saveData };
      setReduced(motion.matches);
    };
    const documentVisibility = () => setForeground(document.visibilityState === "visible");
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 });
    intersection.observe(element);
    motion.addEventListener("change", sync); document.addEventListener("visibilitychange", documentVisibility);
    sync(); documentVisibility();
    return () => { intersection.disconnect(); motion.removeEventListener("change", sync); document.removeEventListener("visibilitychange", documentVisibility); };
  }, []);

  useEffect(() => { if (isActive && tier.current) setInitialized(true); }, [isActive]);
  useEffect(() => {
    if (!initialized || !canvas.current) return;
    let cancelled = false, owned: XraySceneController | null = null;
    const target = canvas.current;
    void import("./createXrayScene").then(({ createXrayScene }) => {
      if (cancelled) return null;
      return createXrayScene(target, {
        ...tier.current!, reducedMotion: motionRef.current,
        onReady: () => { if (!cancelled) setReady(true); },
        onFailure: () => { if (!cancelled) setFailed(true); },
        onSystemState: (key, state) => { if (!cancelled) setLoads(previous => previous[key] === state ? previous : { ...previous, [key]: state }); },
      });
    }).then(controller => {
      if (!controller) return;
      owned = controller; if (cancelled) { controller.dispose(); return; }
      scene.current = controller; controller.setZoomed(target.dataset.zoom === "face"); controller.setActive(activeRef.current);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (scene.current === owned) scene.current = null; owned?.dispose(); };
  }, [initialized]);

  useEffect(() => { scene.current?.setZoomed(zoomed); }, [zoomed]);
  useEffect(() => { scene.current?.setActive(isActive); }, [isActive]);
  useEffect(() => { scene.current?.setReducedMotion(reduced); }, [reduced]);
  useEffect(() => { if (ready && intent.current) scene.current?.setSystem(selected); }, [selected, ready, hovered, focused, pinned]);
  const reset = () => { setHovered(null); setFocused(null); setPinned(null); scene.current?.clearInspection(); };
  const toggleZoom = () => setZoomed(value => !value);
  const loadState = selected ? loads[selected] : undefined;
  const status = failed ? "Anatomical preview" : loadState === "loading" ? `Loading ${selected === "nervous" ? "nerves" : selected}…` : loadState === "error" ? "System unavailable · body remains available" : `${systems.find(s => s.key === selected)?.label} · MOVE POINTER OVER BODY`;

  return (
    <div ref={host} className={styles.host} data-xray-hero data-system={selected} data-zoomed={zoomed} data-state={failed ? "fallback" : ready ? "ready" : "static"} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); reset(); } }}>
      <div className={styles.image} role="group" aria-label="Z-Anatomy aligned human body and anatomical systems">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.poster} src="/models/anatomy/preview.webp" width="512" height="900" alt="" decoding="async" loading="lazy" />
        {initialized && !failed && <canvas ref={canvas} className={styles.canvas} data-zoom={zoomed ? "face" : "body"} data-ready={ready} aria-hidden={!ready} tabIndex={ready ? 0 : -1}
          aria-label="Anatomical body. Move the pointer to reveal the selected anatomical system beneath the skin. Click or press Enter to zoom into the face; click or press Enter again to return to the full body."
          onClick={toggleZoom} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleZoom(); } }} />}
      </div>
      <div className={styles.instrument}>
        <div className={styles.controls} role="group" aria-label="Anatomical systems">
          {systems.map(system => <button key={system.key} type="button" className={styles.system} aria-label={system.accessible} aria-pressed={(pinned ?? "skeleton") === system.key} aria-busy={loads[system.key] === "loading"} disabled={!ready || failed} data-selected={selected === system.key} data-loading={loads[system.key] === "loading"}
            onPointerDown={event => { touchSelection.current = event.pointerType === "touch"; }}
            onPointerEnter={event => { if (event.pointerType !== "touch") { intent.current = true; setFocused(null); setHovered(system.key); } }} onPointerLeave={() => setHovered(null)}
            onPointerUp={event => { if (event.pointerType === "touch") { intent.current = true; setPinned(system.key); scene.current?.setSystem(system.key); scene.current?.inspectAtCenter(); } }}
            onFocus={event => { intent.current = true; setFocused(system.key); if (event.currentTarget.matches(":focus-visible")) { scene.current?.setSystem(system.key); scene.current?.inspectAtCenter(); } }} onBlur={() => { setFocused(null); scene.current?.clearInspection(); }}
            onKeyDown={event => { if (event.key !== "Escape" && event.key !== "Tab") { intent.current = true; setFocused(system.key); scene.current?.setSystem(system.key); scene.current?.inspectAtCenter(); } }}
            onClick={event => {
              intent.current = true; setPinned(system.key);
              // Touch focus transfer can blur the previous button after
              // pointerup. Restore its inspection after that focus change.
              if (touchSelection.current || event.detail === 0) {
                scene.current?.setSystem(system.key); scene.current?.inspectAtCenter();
              }
            }}>
            <AnatomyIcon system={system.key} />{system.label}
          </button>)}
        </div>
        <span className={styles.systemStatus} role="status" aria-live="polite">{status}</span>
      </div>
      <div className={styles.caption}>
        <div className={styles.captionLabel}>
          <span>{zoomed ? "FACE SCAN · CLICK TO RETURN" : "ANATOMICAL SCAN · HOVER TO REVEAL · CLICK TO ZOOM"}</span>
          <a className={styles.attribution} href="/models/anatomy/ATTRIBUTION.md" target="_blank" rel="noopener noreferrer">Z-Anatomy · CC BY-SA 4.0</a>
        </div>
      </div>
    </div>
  );
}
