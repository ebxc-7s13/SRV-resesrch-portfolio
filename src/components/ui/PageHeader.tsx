import type { ReactNode } from "react";
import AnimatedText from "./AnimatedText";

export default function PageHeader({
  index,
  label,
  title,
  description,
  children,
}: {
  index: string;
  label: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-header shell">
      <div className="page-heading">
        <div className="eyebrow">
          <span className="index-mark">{index}</span>
          {label}
        </div>
        <h1 className="page-title">
          <AnimatedText as="span" variant="words">
            {title}
          </AnimatedText>
        </h1>
      </div>
      <div className="page-intro">
        {description && (
          <AnimatedText as="p" variant="shimmer">
            {description}
          </AnimatedText>
        )}
        {children}
  </div>
      <div className="header-rule" aria-hidden="true">
        <span />
      </div>
    </header>
  );
}
