"use client";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

// Shared entrance curve — matches --ease-out in design-system.css.
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

type DivProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  delay?: number;
  ariaLabel?: string;
};

/**
 * SSR-safe gate: static markup on the server AND on first client render, so
 * hydration always matches. Motion takes over post-mount only. This also
 * keeps useReducedMotion (a client-only media query) from forking the tree
 * between server and client, and renders static output for reduced-motion
 * users with zero animation code running.
 */
export function useClientMotion() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted && !reduce;
}

/**
 * Above-fold entrance: fade + rise once on mount.
 * transform/opacity only; static render pre-hydration and under reduced motion.
 */
export function Entrance({
  children,
  className,
  id,
  delay = 0,
  ariaLabel,
}: DivProps) {
  const animate = useClientMotion();
  if (!animate) {
    return (
      <div className={className} id={id} aria-label={ariaLabel}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      id={id}
      aria-label={ariaLabel}
      initial={{ opacity: 0, transform: "translateY(24px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Scroll reveal: fades + rises when scrolled into view, once.
 * transform/opacity only; static render under reduced motion.
 */
export function Reveal({
  children,
  className,
  id,
  delay = 0,
  ariaLabel,
}: DivProps) {
  const animate = useClientMotion();
  if (!animate) {
    return (
      <div className={className} id={id} aria-label={ariaLabel}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      id={id}
      aria-label={ariaLabel}
      initial={{ opacity: 0, transform: "translateY(28px)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, margin: "-64px" }}
      transition={{ duration: 0.55, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}
