"use client";
import { useEffect, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import Image from "next/image";
import { useClientMotion } from "./Reveal";

// Shared entrance curve — matches --ease-out in design-system.css.
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export type HeroImage = {
  src: string;
  alt: string;
  href: string;
  ariaLabel: string;
  /** Unit tag, e.g. "01". */
  index: string;
  /** Kicker line, e.g. "02 — ENGINEERING". */
  kicker: string;
  /** Caption preserved from the original plane. */
  caption: string;
  fit: "cover" | "contain";
};

/**
 * One dossier card. Three nested concerns, three elements so transforms
 * never fight: outer = mount entrance + spotlight opacity, inner =
 * spring-smoothed cursor parallax (full transform string, GPU path).
 * No render branching on client-only state — SSR and first client render
 * are identical, so this hydrates cleanly.
 */
function GalleryCard({
  item,
  position,
  active,
  dim,
  sx,
  sy,
  delay,
  onHover,
  onLeave,
}: {
  item: HeroImage;
  position: number;
  active: boolean;
  dim: boolean;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  delay: number;
  onHover: () => void;
  onLeave: () => void;
}) {
  // Deeper cards drift further with the cursor (back 10px → front 30px).
  const depth = 10 + position * 10;
  const x = useTransform(sx, (v) => v * depth);
  const y = useTransform(sy, (v) => v * depth);
  const parallax = useMotionTemplate`translate3d(${x}px, ${y}px, 0)`;

  return (
    <motion.div
      className={`hero-gcard hero-gcard-${position}${active ? " is-active" : ""}`}
      initial={{ opacity: 0, transform: "translateY(26px)" }}
      animate={{
        opacity: active ? 1 : dim ? 0.45 : 0.8,
        transform: "translateY(0px)",
      }}
      transition={{ duration: 0.55, ease: EASE_OUT, delay }}
    >
      <motion.a
        href={item.href}
        aria-label={item.ariaLabel}
        className="hero-gcard-link"
        style={{ transform: parallax }}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        onFocus={onHover}
        onBlur={onLeave}
      >
        <div className="hero-gcard-kicker">
          <span>{item.kicker}</span>
          <span className="hero-gcard-index">{item.index}</span>
        </div>
        <div className="hero-gcard-media">
          <Image
            src={item.src}
            alt={item.alt}
            fill
            sizes="(max-width: 700px) 80vw, 480px"
            className={item.fit === "cover" ? "object-cover" : "object-contain"}
          />
        </div>
        <div className="hero-gcard-caption">
          <span>{item.caption}</span>
          <span aria-hidden="true">↗</span>
        </div>
      </motion.a>
    </motion.div>
  );
}

/**
 * Cursor-reactive dossier stack replacing the three floating hero planes.
 * Same images, links, labels and captions — new choreography: staggered
 * entrance, spring cursor parallax per depth layer, auto-cycling spotlight
 * (hover to take over), and a scroll-linked fade so the stack dissolves
 * into the page as you scroll. Static fan under reduced motion.
 */
export default function HeroGallery({ items }: { items: HeroImage[] }) {
  const live = useClientMotion();
  const [spot, setSpot] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  // Cursor springs — interruptible by design, settle Apple-style.
  const nx = useMotionValue(0);
  const ny = useMotionValue(0);
  const sx = useSpring(nx, { duration: 0.6, bounce: 0.15 });
  const sy = useSpring(ny, { duration: 0.6, bounce: 0.15 });

  // Scroll-linked dissolve across the first viewport of travel.
  const { scrollY } = useScroll();
  const fade = useTransform(scrollY, [0, 560], [1, 0]);
  const rise = useTransform(scrollY, [0, 560], [0, 90]);
  const drift = useMotionTemplate`translate3d(0, ${rise}px, 0)`;

  // Spotlight auto-cycle: paused on hover, off until mounted, off for
  // reduced motion. Interval only — never touches SSR output.
  useEffect(() => {
    if (!live || hover !== null || items.length < 2) return;
    const timer = setInterval(
      () => setSpot((s) => (s + 1) % items.length),
      3400,
    );
    return () => clearInterval(timer);
  }, [live, hover, items.length]);

  const active = live ? (hover ?? spot % items.length) : 0;

  return (
    <motion.div
      className="hero-gallery"
      style={{ opacity: fade, transform: drift }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        nx.set((e.clientX - rect.left) / rect.width - 0.5);
        ny.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
      onMouseLeave={() => {
        nx.set(0);
        ny.set(0);
      }}
    >
      {items.map((item, i) => (
        <GalleryCard
          key={item.href + item.index}
          item={item}
          position={i}
          active={i === active}
          dim={live && i !== active}
          sx={sx}
          sy={sy}
          delay={i * 0.08}
          onHover={() => setHover(i)}
          onLeave={() => setHover(null)}
        />
      ))}
    </motion.div>
  );
}
