"use client";

import { useCarouselSize } from "./useCarouselSize";
import { useState, useRef, useCallback } from "react";

interface Theme {
  id: number;
  title: string;
  description: string;
  icon: string;
}

export default function ResearchCarousel({ themes }: { themes: Theme[] }) {
  const [activeIndex, setActiveIndex] = useState(Math.floor(themes.length / 2));
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  useCarouselSize(containerRef, themes.length);
  // Keyboard steps are high-frequency input: they get a shorter transition
  // than pointer-release steps (asymmetric timing by input source).
  const inputModeRef = useRef<"pointer" | "keyboard">("pointer");
  // Pointer events fire faster than frames (120Hz+ mice); without this gate
  // every move re-renders all slides. Coalesce to one render per frame.
  const dragFrame = useRef(0);
  const pendingOffset = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setDragOffset(0);
    pendingOffset.current = 0;
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      pendingOffset.current = e.clientX - startX;
      if (dragFrame.current) return;
      dragFrame.current = requestAnimationFrame(() => {
        dragFrame.current = 0;
        setDragOffset(pendingOffset.current);
      });
    },
    [isDragging, startX],
  );

  const handlePointerUp = useCallback(() => {
    if (dragFrame.current) {
      cancelAnimationFrame(dragFrame.current);
      dragFrame.current = 0;
    }
    if (!isDragging) return;
    setIsDragging(false);
    inputModeRef.current = "pointer";
    const threshold = 60;
    if (dragOffset < -threshold) {
      setActiveIndex((prev) => (prev + 1) % themes.length);
    } else if (dragOffset > threshold) {
      setActiveIndex((prev) => (prev - 1 + themes.length) % themes.length);
    }
    setDragOffset(0);
  }, [isDragging, dragOffset, themes.length]);

  function getSlideStyle(index: number) {
    const total = themes.length;
    // Calculate shortest distance from active
    let offset = index - activeIndex;
    if (offset > total / 2) offset -= total;
    if (offset < -total / 2) offset += total;

    // Apply drag offset as fractional shift
    const dragShift = isDragging ? dragOffset / 200 : 0;
    const effectiveOffset = offset + dragShift;

    const absOffset = Math.abs(effectiveOffset);

    // More dramatic scale: center=1.15, adjacent=0.7, outer=0.45
    const scale = Math.max(0.4, 1.15 - absOffset * 0.28);

    // Wider horizontal spread
    const translateX = effectiveOffset * 280;

    // Deeper Z for more 3D depth
    const translateZ = -absOffset * 180;

    // Stronger Y rotation for 3D tilt
    const rotateY = effectiveOffset * -12;

    // Aggressive opacity falloff
    const opacity = Math.max(0.25, 1 - absOffset * 0.35);

    // Z-index: center on top
    const zIndex = 10 - Math.round(absOffset);

    // GPU-only transition on explicit properties (never `all`); keyboard
    // steps run faster than pointer steps. Curve matches --ease-out token.
    const stepMs = inputModeRef.current === "keyboard" ? 350 : 450;

    return {
      transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
      opacity,
      zIndex,
      transition: isDragging
        ? "none"
        : `transform ${stepMs}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${stepMs}ms cubic-bezier(0.16, 1, 0.3, 1)`,
    };
  }

  if (!themes.length)
    return (
      <p className="text-slate-400 text-center py-12">
        No research themes yet.
      </p>
    );

  return (
    <div
      ref={containerRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Research themes"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          inputModeRef.current = "keyboard";
          setActiveIndex(
            (prev) =>
              (prev + (e.key === "ArrowLeft" ? -1 : 1) + themes.length) %
              themes.length,
          );
        }
      }}
      className="original-carousel relative w-full py-12 overflow-hidden cursor-grab active:cursor-grabbing select-none"
      style={{ perspective: "1500px", touchAction: "pan-y" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={() => {
        setIsDragging(false);
        setDragOffset(0);
      }}
    >
      {/* 3D carousel track */}
      <div
        data-depth
        className="depth-plane carousel-track theme-track relative flex items-center justify-center"
      >
        {themes.map((theme, index) => {
          const style = getSlideStyle(index);
          const isActive = index === activeIndex;

          return (
            <div
              key={theme.id}
              className="carousel-slide theme-slide"
              style={style}
              aria-hidden={!isActive}
              onClick={() => {
                if (!isDragging) setActiveIndex(index);
              }}
            >
              <div
                data-day-card
                className={`
                  liquid-surface rounded-2xl border p-6
                  transition-[background-color,border-color,box-shadow] duration-300
                  ${
                    isActive
                      ? "bg-gradient-to-br from-indigo-950/60 to-slate-900/80 border-indigo-500/40 shadow-[0_0_40px_rgba(99,102,241,0.2),0_12px_40px_rgba(0,0,0,0.5)]"
                      : "bg-slate-900/60 border-slate-800/60 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
                  }
                `}
              >
                {/* Icon */}
                <div
                  className={`
                    w-16 h-16 rounded-xl flex items-center justify-center mb-4
                    transition-[transform,background-color,box-shadow] duration-300
                    ${
                      isActive
                        ? "bg-indigo-500/20 scale-125 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                        : "bg-slate-800/50 scale-100"
                    }
                  `}
                >
                  <span className="text-3xl">{theme.icon}</span>
                </div>

                {/* Title */}
                <h3
                  className={`
                    font-bold mb-3 leading-snug transition-colors duration-300
                    ${isActive ? "text-white text-xl" : "text-slate-300 text-base"}
                  `}
                >
                  {theme.title}
                </h3>

                {/* Description — only fully visible when active */}
                <p
                  className={`
                    text-sm leading-relaxed transition-opacity duration-300
                    ${isActive ? "text-slate-400 opacity-100" : "text-slate-500 opacity-70"}
                  `}
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: isActive ? undefined : 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {theme.description}
                </p>

                {/* Active indicator bar */}
                <div className="h-0.5 w-full rounded-full mt-4">
                  {/* Width change became a GPU-only scaleX from the left. */}
                  <div
                    className={`
                      h-full w-full origin-left rounded-full
                      transition-transform duration-300
                      ${
                        isActive
                          ? "scale-x-100 bg-gradient-to-r from-indigo-500 to-violet-500"
                          : "scale-x-[0.1] bg-slate-700"
                      }
                    `}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center gap-4 mt-6">
        <button
          className="carousel-control"
          onClick={() =>
            setActiveIndex((prev) => (prev - 1 + themes.length) % themes.length)
          }
          aria-label="Previous theme"
        >
          ← Previous
        </button>
        <button
          className="carousel-control"
          onClick={() => setActiveIndex((prev) => (prev + 1) % themes.length)}
          aria-label="Next theme"
        >
          Next →
        </button>
      </div>
      {/* Navigation dots */}
      <div className="flex items-center justify-center gap-1 mt-8">
        {themes.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              inputModeRef.current = "pointer";
              setActiveIndex(index);
            }}
            className="group flex h-4 w-6 items-center justify-center"
            aria-pressed={index === activeIndex}
            aria-label={`Go to theme ${index + 1}`}
          >
            {/* Width change became a GPU-only scaleX; layout stays stable. */}
            <span
              className={`
                block h-2 w-full rounded-full
                transition-[transform,background-color] duration-300
                ${
                  index === activeIndex
                    ? "scale-x-100 bg-indigo-500"
                    : "scale-x-[0.33] bg-slate-600 group-hover:bg-slate-500"
                }
              `}
            />
          </button>
        ))}
      </div>

      {/* Drag hint */}
      <p className="text-center text-[10px] text-slate-600 mt-3 font-mono uppercase tracking-wider">
        ← Drag or use arrow keys →
      </p>
    </div>
  );
}
