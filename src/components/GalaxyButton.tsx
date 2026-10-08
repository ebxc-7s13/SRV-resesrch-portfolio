import Link from "next/link";
import { useMemo, type AnchorHTMLAttributes, type CSSProperties, type ReactNode } from "react";

type OrbitStar = {
  dx: number;
  dy: number;
  size: number;
  dur: number;
  delay: number;
  op: number;
};

// Deterministic PRNG (mulberry32): identical output on server and client,
// so SSR markup and hydration match exactly with no DOM post-processing.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Faint always-on dust. Module constant: same markup on server and client.
const STATIC_STARS = [
  { dx: -46, dy: -12, size: 2 },
  { dx: 38, dy: 10, size: 3 },
  { dx: 12, dy: -14, size: 2 },
  { dx: -18, dy: 12, size: 2 },
] as const;

type GalaxyButtonProps = {
  href: string;
  /** Per-instance star field so sibling buttons never twinkle in sync. */
  seed?: number;
  /** Must match the wrapped button's own radius so layers sit flush. */
  radius?: string;
  className?: string;
  children: ReactNode;
} & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "className" | "children"
>;

/**
 * Galaxy treatment for homepage CTA/navigation buttons only. The existing
 * anchor keeps every one of its classes, attributes and children (text,
 * href, handlers, magnetic hooks); the wrapper adds hover luminance and
 * orbiting stars on top of the untouched glass look.
 * Server-safe: zero client JS, deterministic stars, no DOM queries.
 */
export default function GalaxyButton({
  href,
  seed = 1,
  radius = "6px",
  className,
  children,
  ...rest
}: GalaxyButtonProps) {
  const orbit = useMemo<OrbitStar[]>(
    () => {
      const rnd = mulberry32(seed * 1000 + 7);
      return Array.from({ length: 10 }, () => ({
        dx: Math.round((rnd() * 2 - 1) * 90),
        dy: Math.round((rnd() * 2 - 1) * 34),
        size: Math.round((2 + rnd() * 4) * 10) / 10,
        dur: Math.round((6 + rnd() * 14) * 10) / 10,
        delay: -Math.round(rnd() * 200) / 10,
        op: Math.round((0.4 + rnd() * 0.5) * 100) / 100,
      }));
    },
    [seed],
  );

  // Internal route destinations use Next.js client-side navigation so the
  // click never triggers a full document reload; the rendered <a> markup,
  // classes, handlers and visuals are identical. Same-page anchors keep a
  // plain anchor for native jump behavior.
  const internal = href.startsWith("/");
  return (
    <div
      className="galaxy-button"
      style={{ "--galaxy-radius": radius } as CSSProperties}
    >
      {internal ? (
        <Link href={href} className={className} {...rest}>
          {children}
        </Link>
      ) : (
        <a href={href} className={className} {...rest}>
          {children}
        </a>
      )}
      <span className="backdrop" aria-hidden="true" />
      <span className="galaxy__container" aria-hidden="true">
        {STATIC_STARS.map((s, i) => (
          <span
            key={i}
            className="star star--static"
            style={{
              left: `calc(50% + ${s.dx}px)`,
              top: `calc(50% + ${s.dy}px)`,
              width: s.size,
              height: s.size,
            }}
          />
        ))}
      </span>
      <span className="galaxy" aria-hidden="true">
        <span className="galaxy__ring">
          {orbit.map((s, i) => (
            <span
              key={i}
              className="star"
              style={
                {
                  "--sx": `${s.dx}px`,
                  "--sy": `${s.dy}px`,
                  "--ss": `${s.size}px`,
                  "--sd": `${s.dur}s`,
                  "--sdel": `${s.delay}s`,
                  "--so": s.op,
                } as CSSProperties
              }
            />
          ))}
        </span>
      </span>
    </div>
  );
}
