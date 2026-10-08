import { SiteText } from "@/components/SiteContent";
import { getDb } from "@/lib/db";
import TimelineClient from "@/components/TimelineClient";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = {
  alternates: { canonical: "/timeline" },
  title: "Research Timeline",
  description:
    "Academic and research milestones — degrees, publications, prototypes, and key achievements in biomedical engineering research.",
};

// Database-backed content is rendered on demand so admin CMS edits are
// visible immediately and no database access happens at build time.
export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const db = getDb();
  // Independent reads share one round-trip batch instead of two sequential
  // awaits (the milestone merge below only needs both result sets).
  const [timeline, publications] = await Promise.all([
    db.all(
      "SELECT * FROM timeline ORDER BY date ASC, sort_order ASC",
    ) as Promise<any[]>,
    db.all(
      "SELECT * FROM publications WHERE status IN ('published', 'accepted') ORDER BY year DESC",
    ) as Promise<any[]>,
  ]);

  const milestones = [
    ...timeline.map((t: any) => ({
      year: t.date,
      title: t.title,
      description: t.description,
      category: t.category,
      icon: t.icon,
    })),
    ...publications.map((p: any) => ({
      year: String(p.year),
      title: `Publication: ${p.title}`,
      description: `${p.status === "accepted" ? "Accepted" : "Published"}${p.journal ? ` in ${p.journal}` : ""}`,
      category: "publication",
      icon: "📄",
    })),
  ].sort((a: any, b: any) => a.year.localeCompare(b.year));

  const categoryColors: Record<string, string> = {
    education: "bg-blue-500",
    research: "bg-emerald-500",
    publication: "bg-indigo-500",
    patent: "bg-amber-500",
    award: "bg-rose-500",
    project: "bg-cyan-500",
    startup: "bg-violet-500",
  };

  const categoryLabels: Record<string, string> = {
    education: "Education",
    research: "Research",
    publication: "Publication",
    patent: "Patent",
    award: "Achievement",
    project: "Project",
    startup: "Startup",
  };

  return (
    <main>
      <PageHeader
        index="06"
        label="Research journey"
        title={
          <SiteText page="timeline" name="hero_title">
            Research <span>Timeline</span>
          </SiteText>
        }
        description={
          <SiteText page="timeline" name="hero_subtitle">
            A chronological view of academic milestones, research achievements,
            publications, and technological innovations.
          </SiteText>
        }
      />
      <section className="shell timeline-archive">
        <TimelineClient
          milestones={milestones}
          categoryColors={categoryColors}
          categoryLabels={categoryLabels}
        />
      </section>
    </main>
  );
}
