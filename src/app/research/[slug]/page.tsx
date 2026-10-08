/* Native laboratory links load its dedicated document security policy. */
/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";
import FigureViewer from "@/components/FigureViewer";
import CaseStudyContents from "@/components/CaseStudyContents";
import { HyperText } from "@/components/ui/hyper-text";
import { getLabContent } from "@/lib/lab-content";

interface Props {
  params: Promise<{ slug: string }>;
}

// Database-backed content is rendered on demand so admin CMS edits are
// visible immediately and no database access happens at build time.
export const dynamic = "force-dynamic";

async function getProject(slug: string) {
  const db = getDb();
  return (await db.get("SELECT * FROM projects WHERE slug = $1", [
    slug,
  ])) as any;
}

async function getMedia(projectId: number) {
  const db = getDb();
  return (await db.all(
    "SELECT * FROM project_media WHERE project_id = $1 ORDER BY sort_order ASC",
    [projectId],
  )) as any[];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project)
    return {
      alternates: { canonical: `/research/${slug}` },
      title: "Project Not Found",
    };
  return {
    alternates: { canonical: `/research/${slug}` },
    title: `${project.title} | Research`,
    description: project.research_problem,
    openGraph: {
      title: project.title,
      description: project.research_problem.substring(0, 200),
      type: "article",
      images: project.cover_image ? [project.cover_image] : [],
    },
  };
}

const sectionConfig: Record<
  string,
  { title: string; num: number; color: string; description?: string }
> = {
  research_problem: { title: "Research Problem", num: 1, color: "red" },
  motivation: { title: "Motivation", num: 2, color: "orange" },
  approach: { title: "Approach", num: 3, color: "amber" },
  methodology: { title: "Methodology", num: 4, color: "yellow" },
  experimental_setup: { title: "Experimental Setup", num: 5, color: "emerald" },
  hardware: { title: "Hardware & Instrumentation", num: 6, color: "teal" },
  data_acquisition: { title: "Data Acquisition", num: 7, color: "cyan" },
  computational_method: {
    title: "Computational Method",
    num: 8,
    color: "blue",
  },
  results: { title: "Results", num: 9, color: "violet" },
  key_contribution: { title: "Key Contribution", num: 10, color: "purple" },
};

function MediaSection({ media, section }: { media: any[]; section: string }) {
  const items = media.filter((m: any) => m.section === section);
  if (items.length === 0) return null;

  return (
    <div className="case-media-gallery">
      {items.map((item: any) => (
        <figure key={item.id} className="group">
          {item.media_type === "image" ? (
            <FigureViewer
              src={item.file_path}
              alt={item.caption || item.caption_title || ""}
              captionTitle={item.caption_title}
              caption={item.caption}
            />
          ) : item.media_type === "video" ? (
            <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-900">
              <video
                controls
                preload="none"
                className="w-full rounded-lg"
                poster=""
              >
                <source src={item.file_path} />
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <a href={item.file_path} className="text-indigo-400 underline">
              {item.caption_title ||
                item.caption ||
                "Download research document"}{" "}
              ↗
            </a>
          )}
        </figure>
      ))}
    </div>
  );
}

export default async function ResearchProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  const [media, labContent] = await Promise.all([
    getMedia(project.id),
    getLabContent(),
  ]);
  const device = labContent.devices.find(
    (item) => item.project?.id === project.id,
  );

  // Get section keys that have content
  const activeSections = Object.entries(sectionConfig)
    .filter(([key]) => project[key] || media.some((m) => m.section === key))
    .map(([key, config]) => ({ key, ...config }));

  // Section order for media lookup

  return (
    <main className="min-h-screen bg-slate-950">
      <article className="case-study shell" id="case-top">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-8">
          <Link
            href="/research"
            className="hover:text-indigo-400 transition-colors"
          >
            Research
          </Link>
          <span>/</span>
          <span className="text-slate-300 truncate">{project.title}</span>
        </nav>

        <div className="case-hero">
          <header>
            <div className="eyebrow">
              Research case study{" "}
              <span className="status-tag">
                {String(project.status).replaceAll("_", " ")}
              </span>
            </div>
            <h1>{project.title}</h1>
            <div className="case-hero-meta">
              <span>{activeSections.length} study sections</span>
              <span>{media.length} figures & media</span>
            </div>
            {device && (
              <a className="button" href={`/?device=${device.id}#lab`}>
                Inspect the research device in 3D ↓
              </a>
            )}
          </header>
          {project.cover_image && (
            <div className="case-hero-media" data-depth>
              <FigureViewer
                src={project.cover_image}
                alt={project.title}
                captionTitle="Project overview"
              />
            </div>
          )}
        </div>
        <div className="case-reading-layout">
          <aside>
            <CaseStudyContents sections={activeSections} />
          </aside>
          <div className="case-reading-body">
            {/* Case Study Sections */}
            <div className="case-sections">
              {activeSections.map(({ key, title, num }, sectionIndex) => {
                const value = project[key];

                return (
                  <section
                    key={key}
                    id={`section-${key}`}
                    className="case-section"
                    data-reveal
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <span className="index-mark">{num}</span>
                      <h2 className="text-xl md:text-2xl font-bold text-white">
                        {title}
                      </h2>
                    </div>

                    <div className="prose prose-invert prose-slate max-w-none">
                      {sectionIndex === 0 &&
                      typeof value === "string" &&
                      value.length > 0 ? (
                        <HyperText
                          as="p"
                          className="text-slate-300 leading-relaxed whitespace-pre-line"
                          duration={650}
                          startOnView={false}
                          animateOnHover
                        >
                          {value}
                        </HyperText>
                      ) : (
                        <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                          {value}
                        </p>
                      )}
                    </div>

                    {/* Media for this section */}
                    <MediaSection media={media} section={key} />
                  </section>
                );
              })}
            </div>

            {media.some((m) => !sectionConfig[m.section]) && (
              <section className="mt-12">
                <h2>Additional research material</h2>
                <MediaSection
                  media={media.map((m) => ({
                    ...m,
                    section: sectionConfig[m.section] ? m.section : "",
                  }))}
                  section=""
                />
              </section>
            )}
            {device && device.patents.length > 0 && (
              <section className="case-associated">
                <div className="eyebrow">Associated patent records</div>
                {device.patents.map((patent) => (
                  <div key={patent.id}>
                    <h2>{patent.title}</h2>
                    <span className="status-tag">
                      {patent.status.replaceAll("_", " ")}
                    </span>
                    <p>{patent.description}</p>
                  </div>
                ))}
                <Link href="/patents" className="text-link">
                  Open the patent archive ↗
                </Link>
              </section>
            )}
            {/* Related Links */}
            <div className="mt-16 pt-8 border-t border-slate-800 flex flex-wrap gap-3">
              <Link
                href="/publications"
                className="px-5 py-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 hover:bg-indigo-500/20 transition-colors text-sm font-medium"
              >
                Publications
              </Link>
              <Link
                href="/research"
                className="px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                All Projects
              </Link>
              <Link
                href="/thesis"
                className="px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                Theses
              </Link>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
