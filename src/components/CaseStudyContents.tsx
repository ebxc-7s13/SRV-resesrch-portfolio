"use client";
import { useEffect, useState } from "react";
export default function CaseStudyContents({
  sections,
}: {
  sections: { key: string; title: string; num: number }[];
}) {
  const [active, setActive] = useState(sections[0]?.key || "");
  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const key = entry.target.id.replace("section-", "");
          if (entry.isIntersecting) visible.add(key);
          else visible.delete(key);
        });
        const next = sections.find((section) => visible.has(section.key));
        if (next) setActive(next.key);
      },
      { rootMargin: "-110px 0px -50% 0px", threshold: 0 },
    );
    sections.forEach((section) => {
      const element = document.getElementById(`section-${section.key}`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [sections]);
  return (
    <nav className="case-contents" aria-label="Case study contents">
      <div className="eyebrow">In this study</div>
      <ol>
        {sections.map((section) => (
          <li key={section.key}>
            <a
              href={`#section-${section.key}`}
              aria-current={active === section.key ? "location" : undefined}
              onClick={() => setActive(section.key)}
            >
              <span>{String(section.num).padStart(2, "0")}</span>
              {section.title}
            </a>
          </li>
        ))}
      </ol>
      <a href="#case-top" className="case-top-link">
        Back to overview ↑
      </a>
    </nav>
  );
}
