import type { ReactNode } from "react";

export default function DepthCard({
  children,
  variant = "research",
  className = "",
}: {
  children: ReactNode;
  variant?:
    | "research"
    | "publication"
    | "patent"
    | "device"
    | "timeline"
    | "note";
  className?: string;
}) {
  return (
    <article
      data-depth
      data-reveal
      className={`depth-card interaction-surface interaction-perspective card-${variant} ${className}`}
    >
      {children}
    </article>
  );
}
