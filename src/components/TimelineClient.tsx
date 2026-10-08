"use client";
import { useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import DepthCard from "./ui/DepthCard";
import { useMotionAllowed } from "./MotionEffects";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface Milestone {
  year: string;
  title: string;
  description: string;
  category: string;
  icon: string;
}
interface Props {
  milestones: Milestone[];
  categoryColors: Record<string, string>;
  categoryLabels: Record<string, string>;
}
const archives: Record<string, { href: string; label: string }> = {
  education: { href: "/about", label: "Academic background" },
  research: { href: "/research", label: "Browse research" },
  project: { href: "/research", label: "Browse projects" },
  publication: { href: "/publications", label: "Browse publications" },
  patent: { href: "/patents", label: "Browse patents" },
};
export default function TimelineClient({ milestones, categoryLabels }: Props) {
  const [category, setCategory] = useState("all");
  const allowed = useMotionAllowed();
  const categories = Array.from(new Set(milestones.map((m) => m.category)));
  const filtered =
    category === "all"
      ? milestones
      : milestones.filter((m) => m.category === category);
  const years = Array.from(new Set(filtered.map((m) => m.year))).sort();

  // Tracing beam (Aceternity pattern): each year's spine draws downward with
  // scroll. Scrubbing a transform only — no layout, no repaints per frame.
  useGSAP(
    () => {
      if (!allowed) return;
      gsap.utils
        .toArray<HTMLElement>(".chronology-beam")
        .forEach((beam) =>
          gsap.fromTo(
            beam,
            { scaleY: 0.001 },
            {
              scaleY: 1,
              ease: "none",
              scrollTrigger: {
                trigger: beam.parentElement,
                start: "top 78%",
                end: "bottom 55%",
                scrub: 0.5,
              },
            },
          ),
        );
    },
    { dependencies: [allowed, category], revertOnUpdate: true },
  );

  return (
    <div>
      <div className="timeline-filters" aria-label="Filter milestones">
        {["all", ...categories].map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={category === key}
            onClick={() => setCategory(key)}
          >
            {key === "all" ? "All milestones" : categoryLabels[key] || key}
          </button>
        ))}
        <span role="status">{filtered.length} milestones</span>
      </div>
      <div className="chronology">
        {years.map((year) => (
          <section className="chronology-year" key={year}>
            <h2>
              {year}
              <span>Research journey</span>
            </h2>
            <div className="chronology-events">
              <div className="chronology-beam" aria-hidden="true" />
              {filtered
                .filter((m) => m.year === year)
                .map((m, index) => (
                  <DepthCard
                    key={`${m.title}-${index}`}
                    variant="timeline"
                    className="milestone-card"
                  >
                    <div className="eyebrow">
                      <i aria-hidden="true" />
                      {categoryLabels[m.category] || m.category}
                    </div>
                    <h3>{m.title}</h3>
                    <p>{m.description}</p>
                    {archives[m.category] && (
                      <Link
                        className="text-link"
                        href={archives[m.category].href}
                      >
                        {archives[m.category].label} ↗
                      </Link>
                    )}
                  </DepthCard>
                ))}
            </div>
          </section>
        ))}
      </div>
      {!filtered.length && (
        <p className="archive-empty">No milestones available.</p>
      )}
    </div>
  );
}
