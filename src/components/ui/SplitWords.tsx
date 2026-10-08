import { cloneElement, isValidElement, type CSSProperties, type ReactNode } from "react";

/**
 * SplitWords — server-rendered text-generation reveal.
 *
 * Wraps every word of the provided content in a `reveal-word` span while
 * preserving nested elements (accent spans, <br/>). Because the split happens
 * in JSX, the DOM React hydrates is identical to the server HTML — no client
 * DOM mutation, no hydration races. The entrance itself is pure CSS driven by
 * the per-word index and only runs when motion is allowed.
 */
export default function SplitWords({ children }: { children: ReactNode }) {
  let index = 0;

  const wrapWords = (text: string, keyPrefix: string): ReactNode =>
    text.split(/(\s+)/).map((part, i) => {
      if (!part) return null;
      if (/^\s+$/.test(part)) return part;
      const wordIndex = index++;
      return (
        <span
          key={`${keyPrefix}-${i}`}
          className="reveal-word"
          style={{ "--wi": wordIndex } as CSSProperties}
        >
          {part}
        </span>
      );
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

  return <>{walk(children, "w")}</>;
}
