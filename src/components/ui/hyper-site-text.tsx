"use client";

import { HyperText } from "./hyper-text";
import { useSiteValue } from "../SiteContent";

type HyperSiteTextProps = {
  page: string;
  name: string;
  /** Exact fallback copy (must match the SiteText children it replaces). */
  fallback: string;
  /** Small, attractive hover scramble duration in ms. */
  duration?: number;
  className?: string;
};

/**
 * HyperSiteText — CMS-aware Magic UI Hyper Text for major paragraphs.
 *
 * Resolves the admin-edited `site_content` value (or the exact fallback copy)
 * and renders it as an inherited-style `span` inside the existing
 * `<p>`/`<blockquote>`, so typography, spacing, and layout are untouched.
 * Hover-only: the scramble fires solely while the mouse is over the
 * paragraph — never on load, never on scroll. Touch and reduced-motion
 * users always see the final text directly.
 */
export default function HyperSiteText({
  page,
  name,
  fallback,
  duration = 650,
  className,
}: HyperSiteTextProps) {
  const value = useSiteValue(page, name);
  const text = value ?? fallback;
  return (
    <HyperText
      as="span"
      className={className}
      duration={duration}
      startOnView={false}
      animateOnHover
    >
      {text}
    </HyperText>
  );
}
