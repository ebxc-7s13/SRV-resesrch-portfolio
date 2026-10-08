"use client";
import { usePathname } from "next/navigation";

export default function ResearchEnvironment() {
  const path = usePathname();
  const kind =
    path === "/"
      ? "data"
      : path === "/research"
        ? "neural"
        : path.startsWith("/research/") || path === "/patents"
          ? "blueprint"
          : path === "/contact"
            ? "signal"
            : path === "/about"
              ? "identity"
              : path === "/timeline"
                ? "temporal"
                : path.startsWith("/blog")
                  ? "particle"
                  : "archive";
  return (
    <div
      className={`research-environment environment-${kind}`}
      aria-hidden="true"
    >
      <div className="environment-grid" />
      <div className="environment-floor">
        <div />
        <span />
        <i />
      </div>
      <div className="environment-light" />
      <div className="environment-data-field">
        {Array.from({ length: 24 }, (_, i) => {
          const x = 8 + ((i * 37) % 86),
            y = 6 + ((i * 23) % 88);
          return (
            <span
              key={i}
              data-field-node
              data-x={x}
              data-y={y}
              className={`field-layer-${i % 3}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <i />
              {i % 6 === 0 && (
                <small>
                  {String(i).padStart(2, "0")} / {kind.toUpperCase()}
                </small>
              )}
            </span>
          );
        })}
      </div>
      <svg
        className="environment-network"
        viewBox="0 0 1000 800"
        fill="none"
        preserveAspectRatio="none"
      >
        {Array.from({ length: 18 }, (_, i) => {
          const x = 80 + ((i * 137) % 840),
            y = 60 + ((i * 173) % 680),
            nx = 80 + (((i + 1) * 137) % 840),
            ny = 60 + (((i + 1) * 173) % 680);
          return (
            <g key={i}>
              <path
                d={
                  kind === "temporal"
                    ? `M ${x} ${y} Q 500 ${y} ${nx} ${ny}`
                    : `M ${x} ${y} L ${nx} ${ny}`
                }
              />
              <circle cx={x} cy={y} r={i % 3 === 0 ? 5 : 2} />
            </g>
          );
        })}
      </svg>
      <svg className="environment-contour" viewBox="0 0 900 700" fill="none">
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M ${100 + i * 28} 650 V ${300 - i * 26} Q ${100 + i * 28} ${160 - i * 20} ${250 + i * 36} ${160 - i * 20} H 900`}
          />
        ))}
        <circle cx="532" cy="80" r="5" />
        <circle cx="184" cy="350" r="5" />
      </svg>
    </div>
  );
}
