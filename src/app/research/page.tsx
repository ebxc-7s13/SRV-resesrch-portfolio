import { SiteText } from "@/components/SiteContent";
import { getDb } from "@/lib/db";
import PageHeader from "@/components/ui/PageHeader";
import ProjectCarousel from "@/components/ProjectCarousel";

export const metadata = {
  alternates: { canonical: "/research" },
  title: "Research Projects",
  description:
    "Research projects in biomedical imaging, AI diagnostics, microgravity simulation, and medical instrumentation — presented as complete case studies.",
};

// Database-backed content is rendered on demand so admin CMS edits are
// visible immediately and no database access happens at build time.
export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const db = getDb();

  // Independent reads share one round-trip batch instead of two sequential
  // awaits (the counts never depended on the project rows).
  const [projects, mediaCounts] = await Promise.all([
    db.all(
      "SELECT * FROM projects ORDER BY featured DESC, sort_order ASC, created_at DESC",
    ) as Promise<any[]>,
    db.all(
      "SELECT project_id, COUNT(*)::int AS count FROM project_media GROUP BY project_id",
    ) as Promise<any[]>,
  ]);
  const countMap = new Map(
    mediaCounts.map((m: any) => [m.project_id, m.count]),
  );

  return (
    <main className="min-h-screen bg-slate-950">
      <PageHeader
        index="01"
        label="Research / Case studies"
        title={
          <SiteText page="research" name="hero_title">
            Research <span>in focus.</span>
          </SiteText>
        }
        description={
          <SiteText page="research" name="hero_subtitle">
            Each project is presented as a complete case study — from problem
            formulation through methodology, experimentation, and results.
          </SiteText>
        }
      />
      <section className="research-content">
        <ProjectCarousel
          projects={projects.map((p: any) => ({
            ...p,
            media_count: countMap.get(p.id) || 0,
          }))}
        />
      </section>
    </main>
  );
}
