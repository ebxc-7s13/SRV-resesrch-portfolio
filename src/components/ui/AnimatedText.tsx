import { cloneElement, isValidElement, type CSSProperties, type ReactNode } from "react";

export type TextAnimVariant = "words" | "chars" | "shimmer" | "scan" | "type" | "lines" | "none";

type AnimatedTextProps = {
  children: ReactNode;
  /** Visual variant. `words` preserves the existing SplitWords entrance. */
  variant?: TextAnimVariant;
  /** Rendered element. Defaults to span to stay drop-in inside h1/h2/p. */
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  className?: string;
  /** Show a typewriter caret when variant="type". */
  caret?: boolean;
  /** Accessible label when the split spans would otherwise fragment SR output. */
  ariaLabel?: string;
};

/**
 * AnimatedText — SSR-safe text animation primitive (SCSS-driven).
 *
 * Splits copy into word/char/line spans in JSX so server HTML === hydrated DOM
 * (no client DOM mutation, no hydration races — same contract as SplitWords).
 * The entrance itself is pure CSS in `src/styles/text-animations.scss` and only
 * runs under `html[data-motion-running="true"]` + no-preference motion.
 * Reduced / paused motion renders plain readable text.
 */
export default function AnimatedText({
  children,
  variant = "words",
  as = "span",
  className = "",
  caret = false,
  ariaLabel,
}: AnimatedTextProps) {
  if (variant === "none") {
    const TagNone = as;
    return (
      <TagNone className={className} aria-label={ariaLabel}>
        {children}
      </TagNone>
    );
  }

  if (variant === "shimmer" || variant === "scan") {
    const TagStatic = as;
    return (
      <TagStatic
        className={`t-anim ${className}`.trim()}
        data-anim={variant}
        aria-label={ariaLabel}
      >
        {children}
      </TagStatic>
    );
  }

  if (variant === "type") {
    const TagType = as;
    return (
      <TagType
        className={`t-anim ${className}`.trim()}
        data-anim="type"
        data-caret={caret ? "true" : undefined}
        aria-label={ariaLabel}
      >
        {children}
      </TagType>
    );
  }

  if (variant === "lines") {
    let lineIndex = 0;
    const lines = splitLines(children);
    const TagLines = as;
    return (
      <TagLines
        className={`t-anim ${className}`.trim()}
        data-anim="lines"
        aria-label={ariaLabel}
      >
        {lines.map((line, i) => (
          <span
            key={`line-${i}`}
            className="t-line"
            style={{ "--li": lineIndex++ } as CSSProperties}
          >
            <span>{line}</span>
          </span>
        ))}
      </TagLines>
    );
  }

  // words | chars — word/char split preserving nested elements (accent spans, <br/>).
  let wordIndex = 0;
  let charIndex = 0;

  const wrapWord = (word: string, key: string): ReactNode => {
    if (variant === "chars") {
      return (
        <span key={key} className="t-word" style={{ whiteSpace: "nowrap" }}>
          {word.split("").map((ch, ci) => {
            const c = charIndex++;
            return (
              <span
                key={`${key}-c${ci}`}
                className="t-char reveal-char"
                style={{ "--ci": c } as CSSProperties}
                aria-hidden={ariaLabel ? "true" : undefined}
              >
                {ch}
              </span>
            );
          })}
        </span>
      );
    }
    const w = wordIndex++;
    return (
      <span
        key={key}
        className="reveal-word t-word"
        style={{ "--wi": w } as CSSProperties}
        aria-hidden={ariaLabel ? "true" : undefined}
      >
        {word}
      </span>
    );
  };

  const wrapWords = (text: string, keyPrefix: string): ReactNode =>
    text.split(/(\s+)/).map((part, i) => {
      if (!part) return null;
      if (/^\s+$/.test(part)) return part;
      return wrapWord(part, `${keyPrefix}-${i}`);
    });

  const walk = (node: ReactNode, keyPrefix: string): ReactNode => {
    if (typeof node === "string" || typeof node === "number")
      return wrapWords(String(node), keyPrefix);
    if (Array.isArray(node))
      return node.map((child, i) => walk(child, `${keyPrefix}-${i}`));
    if (isValidElement(node)) {
      const element = node as React.ReactElement<{ children?: ReactNode }>;
      if (element.props.children != null) {
        return cloneElement(
          element,
          { key: element.key ?? keyPrefix },
          walk(element.props.children, `${keyPrefix}c`),
        );
      }
      return node;
    }
    return node;
  };

  const Tag = as;
  return (
    <Tag
      className={`t-anim ${className}`.trim()}
      data-anim={variant}
      aria-label={ariaLabel}
    >
      {walk(children, "w")}
    </Tag>
  );
}

/** Split children on <br/> into line groups for the `lines` variant. */
function splitLines(children: ReactNode): ReactNode[] {
  const lines: ReactNode[] = [];
  let current: ReactNode[] = [];
  const push = () => {
    if (current.length) lines.push(current.length === 1 ? current[0] : current.slice());
    current = [];
  };
  const visit = (node: ReactNode): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (isValidElement(node) && (node.type === "br" || (node as { type?: unknown }).type === "br")) {
      push();
      return;
    }
    current.push(node);
  };
  visit(children);
  push();
  return lines.length ? lines : [children];
}
