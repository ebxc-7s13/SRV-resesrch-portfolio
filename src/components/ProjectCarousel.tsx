"use client";
import { useMemo, useRef, useState } from "react";
import ResearchCard, { type ResearchCardData } from "./ui/ResearchCard";
import { useMotionAllowed } from "./MotionEffects";
export default function ProjectCarousel({
  projects,
}: {
  projects: ResearchCardData[];
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const allowed = useMotionAllowed();
  const filtered = useMemo(
    () =>
      projects.filter((p) =>
        `${p.title} ${p.status}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [projects, query],
  );
  function go(next: number) {
    const element = track.current?.children[next] as HTMLElement | undefined;
    if (!element || !track.current) return;
    track.current.scrollTo({
      left: element.offsetLeft,
      behavior: allowed ? "smooth" : "instant",
    });
    setIndex(next);
  }
  return (
    <div className="research-discovery shell">
      <div className="discovery-toolbar">
        <div>
          <span className="eyebrow">Project index</span>
          <p aria-live="polite">
            {filtered.length} research{" "}
            {filtered.length === 1 ? "record" : "records"}
          </p>
        </div>
        <label className="archive-search">
          <span>Find a project</span>
          <input
            type="search"
            value={query}
            placeholder="Search titles or status…"
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
              track.current?.scrollTo({ left: 0, behavior: "instant" });
            }}
          />
        </label>
      </div>
      {filtered.length ? (
        <>
          <div
            ref={track}
            className="research-study-track"
            role="region"
            aria-label="Research project gallery"
            aria-roledescription="carousel"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                go(
                  Math.max(
                    0,
                    Math.min(
                      filtered.length - 1,
                      index + (e.key === "ArrowRight" ? 1 : -1),
                    ),
                  ),
                );
              }
            }}
            onScroll={() => {
              const el = track.current;
              if (!el) return;
              const children = Array.from(el.children) as HTMLElement[];
              const nearest = children.reduce(
                (best, child, i) =>
                  Math.abs(child.offsetLeft - el.scrollLeft) <
                  Math.abs(children[best].offsetLeft - el.scrollLeft)
                    ? i
                    : best,
                0,
              );
              setIndex(nearest);
            }}
          >
            {filtered.map((project, i) => (
              <div
                className="research-study"
                key={project.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${filtered.length}`}
              >
                <ResearchCard project={project} index={i} />
              </div>
            ))}
          </div>
          <div className="discovery-controls">
            <p>
              <span>{String(index + 1).padStart(2, "0")}</span> /{" "}
              {String(filtered.length).padStart(2, "0")}{" "}
              <span className="discovery-hint">
                Swipe or choose a record below
              </span>
            </p>
            <div>
              <button
                className="carousel-control"
                disabled={index === 0}
                onClick={() => go(index - 1)}
                aria-label="Previous project"
              >
                ←
              </button>
              <button
                className="carousel-control"
                disabled={index === filtered.length - 1}
                onClick={() => go(index + 1)}
                aria-label="Next project"
              >
                →
              </button>
            </div>
          </div>
          <ol className="project-index">
            {filtered.map((project, i) => (
              <li key={project.id}>
                <button aria-pressed={index === i} onClick={() => go(i)}>
                  <span className="index-mark">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{project.title}</span>
                  <span aria-hidden="true">↗</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="empty-records">
          <h2>No matching projects</h2>
          <p>Try another title or status.</p>
          <button className="button secondary" onClick={() => setQuery("")}>
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
