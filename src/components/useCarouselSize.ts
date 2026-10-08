"use client";
import { useEffect, type RefObject } from "react";

/** Size the original 3D track to the tallest card, including its center scale. */
export function useCarouselSize(
  container: RefObject<HTMLDivElement | null>,
  count: number,
) {
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const slides = [...root.querySelectorAll<HTMLElement>(".carousel-slide")];
    const measure = () =>
      root.style.setProperty(
        "--carousel-height",
        Math.ceil(
          Math.max(0, ...slides.map((slide) => slide.offsetHeight)) * 1.15 + 48,
        ) + "px",
      );
    const observer = new ResizeObserver(measure);
    slides.forEach((slide) => observer.observe(slide));
    measure();
    return () => observer.disconnect();
  }, [container, count]);
}
