"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  AMBIENT_TUNING_LIMITS,
  DEFAULT_AMBIENT_TUNING,
  resetAmbientTuning,
  setAmbientTuning,
  useAmbientTuning,
} from "@/lib/ambient-tuning";
import {
  setBackgroundMode,
  useBackgroundMode,
  type BackgroundMode,
} from "@/lib/background-mode";
import {
  CELLS_TUNING_LIMITS,
  DEFAULT_CELLS_TUNING,
  resetCellsTuning,
  setCellsTuning,
  useCellsTuning,
} from "@/lib/cells-tuning";
import {
  DEFAULT_LIQUID_TUNING,
  LIQUID_TUNING_LIMITS,
  resetLiquidTuning,
  setLiquidTuning,
  useLiquidTuning,
} from "@/lib/liquid-tuning";

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="cells-slider">
      <div className="cells-slider-head">
        <label htmlFor={id}>{label}</label>
        <span aria-hidden="true">{value.toFixed(2)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={`${label} ${value.toFixed(2)}`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function CellsSliders() {
  const tuning = useCellsTuning();
  const isDefault =
    tuning.brightness === DEFAULT_CELLS_TUNING.brightness &&
    tuning.speed === DEFAULT_CELLS_TUNING.speed &&
    tuning.size === DEFAULT_CELLS_TUNING.size;
  return (
    <>
      <Slider
        label="Brightness"
        value={tuning.brightness}
        min={CELLS_TUNING_LIMITS.brightness.min}
        max={CELLS_TUNING_LIMITS.brightness.max}
        step={CELLS_TUNING_LIMITS.brightness.step}
        onChange={(brightness) => setCellsTuning({ brightness })}
      />
      <Slider
        label="Speed"
        value={tuning.speed}
        min={CELLS_TUNING_LIMITS.speed.min}
        max={CELLS_TUNING_LIMITS.speed.max}
        step={CELLS_TUNING_LIMITS.speed.step}
        onChange={(speed) => setCellsTuning({ speed })}
      />
      <Slider
        label="Cell size"
        value={tuning.size}
        min={CELLS_TUNING_LIMITS.size.min}
        max={CELLS_TUNING_LIMITS.size.max}
        step={CELLS_TUNING_LIMITS.size.step}
        onChange={(size) => setCellsTuning({ size })}
      />
      <button
        type="button"
        className="cells-reset"
        disabled={isDefault}
        onClick={resetCellsTuning}
      >
        Reset to defaults
      </button>
    </>
  );
}

function AmbientSliders() {
  const tuning = useAmbientTuning();
  const isDefault =
    tuning.brightness === DEFAULT_AMBIENT_TUNING.brightness &&
    tuning.speed === DEFAULT_AMBIENT_TUNING.speed &&
    tuning.warp === DEFAULT_AMBIENT_TUNING.warp &&
    tuning.scale === DEFAULT_AMBIENT_TUNING.scale;
  return (
    <>
      <Slider
        label="Brightness"
        value={tuning.brightness}
        min={AMBIENT_TUNING_LIMITS.brightness.min}
        max={AMBIENT_TUNING_LIMITS.brightness.max}
        step={AMBIENT_TUNING_LIMITS.brightness.step}
        onChange={(brightness) => setAmbientTuning({ brightness })}
      />
      <Slider
        label="Speed"
        value={tuning.speed}
        min={AMBIENT_TUNING_LIMITS.speed.min}
        max={AMBIENT_TUNING_LIMITS.speed.max}
        step={AMBIENT_TUNING_LIMITS.speed.step}
        onChange={(speed) => setAmbientTuning({ speed })}
      />
      <Slider
        label="Warp"
        value={tuning.warp}
        min={AMBIENT_TUNING_LIMITS.warp.min}
        max={AMBIENT_TUNING_LIMITS.warp.max}
        step={AMBIENT_TUNING_LIMITS.warp.step}
        onChange={(warp) => setAmbientTuning({ warp })}
      />
      <Slider
        label="Scale"
        value={tuning.scale}
        min={AMBIENT_TUNING_LIMITS.scale.min}
        max={AMBIENT_TUNING_LIMITS.scale.max}
        step={AMBIENT_TUNING_LIMITS.scale.step}
        onChange={(scale) => setAmbientTuning({ scale })}
      />
      <button
        type="button"
        className="cells-reset"
        disabled={isDefault}
        onClick={resetAmbientTuning}
      >
        Reset to defaults
      </button>
    </>
  );
}

function LiquidSliders() {
  const tuning = useLiquidTuning();
  const isDefault =
    tuning.brightness === DEFAULT_LIQUID_TUNING.brightness &&
    tuning.displacement === DEFAULT_LIQUID_TUNING.displacement &&
    tuning.metalness === DEFAULT_LIQUID_TUNING.metalness &&
    tuning.roughness === DEFAULT_LIQUID_TUNING.roughness &&
    tuning.rain === DEFAULT_LIQUID_TUNING.rain;
  return (
    <>
      <Slider
        label="Ripple depth"
        value={tuning.displacement}
        min={LIQUID_TUNING_LIMITS.displacement.min}
        max={LIQUID_TUNING_LIMITS.displacement.max}
        step={LIQUID_TUNING_LIMITS.displacement.step}
        onChange={(displacement) => setLiquidTuning({ displacement })}
      />
      <Slider
        label="Metalness"
        value={tuning.metalness}
        min={LIQUID_TUNING_LIMITS.metalness.min}
        max={LIQUID_TUNING_LIMITS.metalness.max}
        step={LIQUID_TUNING_LIMITS.metalness.step}
        onChange={(metalness) => setLiquidTuning({ metalness })}
      />
      <Slider
        label="Roughness"
        value={tuning.roughness}
        min={LIQUID_TUNING_LIMITS.roughness.min}
        max={LIQUID_TUNING_LIMITS.roughness.max}
        step={LIQUID_TUNING_LIMITS.roughness.step}
        onChange={(roughness) => setLiquidTuning({ roughness })}
      />
      <Slider
        label="Brightness"
        value={tuning.brightness}
        min={LIQUID_TUNING_LIMITS.brightness.min}
        max={LIQUID_TUNING_LIMITS.brightness.max}
        step={LIQUID_TUNING_LIMITS.brightness.step}
        onChange={(brightness) => setLiquidTuning({ brightness })}
      />
      <label className="cells-toggle">
        <input
          type="checkbox"
          checked={tuning.rain}
          onChange={(e) => setLiquidTuning({ rain: e.target.checked })}
        />
        <span>Rain drops</span>
      </label>
      <button
        type="button"
        className="cells-reset"
        disabled={isDefault}
        onClick={resetLiquidTuning}
      >
        Reset to defaults
      </button>
    </>
  );
}

// Single environment control for the top-right of the menu: a 3D-bezel orb
// button that cycles Ambient → Cells → Liquid, plus a small downward arrow
// that opens this environment's slider popup (water parameters for liquid:
// ripple depth / metalness / roughness / brightness / rain).
export default function CellsControl() {
  const mode = useBackgroundMode();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const modeOrder: BackgroundMode[] = ["ambient", "cells", "liquid"];
  const modeLabel = mode[0].toUpperCase() + mode.slice(1);
  const next = modeOrder[(modeOrder.indexOf(mode) + 1) % modeOrder.length];
  const nextLabel = next[0].toUpperCase() + next.slice(1);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  // The popup always edits the live environment; switching environments
  // while it is open keeps it open on the new sliders.
  return (
    <div className="cells-control" ref={rootRef}>
      <div
        className="env-button"
        role="group"
        aria-label="Background environment"
      >
        <button
          type="button"
          className="env-main"
          data-pointer
          aria-label={`Environment: ${modeLabel} — switch to ${nextLabel}`}
          title={`Switch to ${nextLabel} background`}
          onClick={() => setBackgroundMode(next)}
        >
          <span className="env-orb" aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 3 9 5-9 5-9-5 9-5Z" />
              <path d="m3 12.5 9 5 9-5" />
              <path d="m3 17 9 5 9-5" />
            </svg>
          </span>
          <span className="env-label">{modeLabel}</span>
        </button>
        <button
          type="button"
          className="env-arrow"
          data-pointer
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={
            open ? `Close ${modeLabel} settings` : `Open ${modeLabel} settings`
          }
          title={`${modeLabel} settings`}
          onClick={() => setOpen(!open)}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={open ? "env-chevron-open" : undefined}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      {open && (
        <div
          id={panelId}
          className="cells-popup"
          role="dialog"
          aria-label={`${modeLabel} background settings`}
        >
          <div className="cells-popup-head">
            <span>{modeLabel} settings</span>
            <button
              type="button"
              className="cells-close"
              aria-label="Close settings"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          {mode === "cells" ? (
            <CellsSliders />
          ) : mode === "liquid" ? (
            <LiquidSliders />
          ) : (
            <AmbientSliders />
          )}
        </div>
      )}
    </div>
  );
}
