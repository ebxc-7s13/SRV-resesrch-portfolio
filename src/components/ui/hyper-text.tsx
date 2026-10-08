"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type RefAttributes,
} from "react";
import {
  motion,
  useReducedMotion,
  type DOMMotionComponents,
  type HTMLMotionProps,
  type MotionProps,
} from "motion/react";

import { cn } from "@/lib/utils";

type CharacterSet = string[] | readonly string[];

const motionElements = {
  article: motion.article,
  div: motion.div,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  h5: motion.h5,
  h6: motion.h6,
  li: motion.li,
  p: motion.p,
  section: motion.section,
  span: motion.span,
} as const;

type MotionElementType = Extract<
  keyof DOMMotionComponents,
  keyof typeof motionElements
>;
type HyperTextMotionComponent = ComponentType<
  Omit<HTMLMotionProps<"div">, "ref"> & RefAttributes<HTMLElement>
>;

interface HyperTextProps extends Omit<MotionProps, "children"> {
  /** The text content to be animated */
  children: string;
  /** Optional className for styling */
  className?: string;
  /** Duration of the animation in milliseconds */
  duration?: number;
  /** Delay before animation starts in milliseconds */
  delay?: number;
  /** Component to render as - defaults to div */
  as?: MotionElementType;
  /** Whether to start animation when element comes into view */
  startOnView?: boolean;
  /** Whether to trigger animation on hover */
  animateOnHover?: boolean;
  /** Custom character set for scramble effect. Defaults to uppercase alphabet */
  characterSet?: CharacterSet;
}

const DEFAULT_CHARACTER_SET = Object.freeze(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
) as readonly string[];

const getRandomInt = (max: number): number =>
  Math.floor(Math.random() * max);

/**
 * Magic UI Hyper Text — vendored from the official registry
 * (`@magicui/hyper-text`) so no shadcn CLI / config changes are needed.
 *
 * Portfolio adaptations (visual system + content preservation):
 * - No default typography classes and no uppercasing: the component inherits
 *   the surrounding font/size/weight/color and renders the exact text given.
 * - Whitespace (spaces, newlines, tabs) is never scrambled, so `pre-line`
 *   blocks keep their line breaks and no layout shift occurs (same character
 *   count before, during, and after the animation).
 * - SSR renders the final text; the scramble only runs post-mount on the
 *   client, so server HTML === hydrated DOM (no hydration mismatch).
 * - `prefers-reduced-motion` users always see the final text directly.
 * - Hover-only mode: with `startOnView={false}` + `animateOnHover={true}`
 *   nothing runs on load or on scroll — the scramble fires only while the
 *   mouse is over the text (re-triggerable, never overlapping itself).
 */
export function HyperText({
  children,
  className,
  duration = 800,
  delay = 0,
  as: Component = "div",
  startOnView = false,
  animateOnHover = true,
  characterSet = DEFAULT_CHARACTER_SET,
  ...props
}: HyperTextProps) {
  const MotionComponent =
    motionElements[Component] as HyperTextMotionComponent;

  const [displayText, setDisplayText] = useState<string[]>(() =>
    children.split(""),
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const iterationCount = useRef(0);
  const elementRef = useRef<HTMLElement | null>(null);

  // SSR-safe reduced-motion gate (same contract as `Reveal`): static final
  // text on the server and first client render; motion only post-mount.
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const motionOK = mounted && !prefersReducedMotion;

  const handleAnimationTrigger = () => {
    if (animateOnHover && !isAnimating && motionOK) {
      iterationCount.current = 0;
      setIsAnimating(true);
    }
  };

  // Handle animation start based on view, hover-only, or delay.
  // Hover-only (animateOnHover without startOnView) never auto-starts:
  // the scramble runs solely from onMouseEnter while hovered.
  useEffect(() => {
    if (!motionOK) return;
    if (!startOnView && !animateOnHover) {
      const startTimeout = setTimeout(() => {
        setIsAnimating(true);
      }, delay);
      return () => clearTimeout(startTimeout);
    }
    if (!startOnView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setIsAnimating(true);
          }, delay);
          observer.disconnect();
        }
      },
      { threshold: 0.3, rootMargin: "0px 0px -10% 0px" },
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [delay, startOnView, animateOnHover, motionOK]);

  // Keep SSR/first-render output in sync when the text resolves later
  // (e.g. CMS values) while an animation is not running.
  useEffect(() => {
    if (!isAnimating) {
      iterationCount.current = 0;
      setDisplayText(children.split(""));
    }
  }, [children, isAnimating]);

  // Handle scramble animation
  useEffect(() => {
    if (!motionOK) return;
    let animationFrameId: number | null = null;

    if (isAnimating) {
      const maxIterations = children.length;
      const startTime = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        iterationCount.current = progress * maxIterations;

        setDisplayText(() =>
          children.split("").map((letter, index) =>
            /\s/.test(letter)
              ? letter
              : index <= iterationCount.current
                ? letter
                : characterSet[getRandomInt(characterSet.length)],
          ),
        );

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
        }
      };

      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [children, duration, isAnimating, characterSet, motionOK]);

  return (
    <MotionComponent
      ref={elementRef}
      className={cn(className)}
      onMouseEnter={handleAnimationTrigger}
      {...props}
    >
      {displayText.map((letter, index) => (
        <span key={index}>{letter}</span>
      ))}
    </MotionComponent>
  );
}
