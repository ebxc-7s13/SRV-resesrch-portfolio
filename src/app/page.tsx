import type { CSSProperties } from "react";
import { Suspense } from "react";
import { SiteText } from "@/components/SiteContent";
import { getDb } from "@/lib/db";
import { getLabContent } from "@/lib/lab-content";
import Link from "next/link";
import ResearchHero from "@/components/ResearchHero";
import XrayHero from "@/components/xray/XrayHero";
import HomeLabSection from "@/components/HomeLabSection";
import ResearchCard from "@/components/ui/ResearchCard";
import GlassTitle from "@/components/GlassTitle";
import GalaxyButton from "@/components/GalaxyButton";
import HyperSiteText from "@/components/ui/hyper-site-text";
import "./lab/lab.css";
import "./home-lab.css";

// Database-backed content is rendered on demand so admin CMS edits are
// visible immediately and no database access happens at build time.
export const dynamic = "force-dynamic";

// Progressive page loading: the hero (above the fold) only waits for one
// tiny counts query, while each below-fold section fetches its own data and
// streams in via Suspense. Same queries, same markup — the first byte and the
// hero paint no longer wait for the slowest below-fold section. Fallbacks are
// null (all suspended content is below the fold), so nothing flashes.
async function LabSection() {
  const labContent = await getLabContent().catch(() => ({
    devices: [],
    publications: [],
    unavailable: true,
  }));
  return <HomeLabSection content={labContent} />;
}

async function FeaturedSection() {
  const projects = (await getDb().all(
    "SELECT * FROM projects ORDER BY featured DESC, created_at DESC LIMIT 3",
  )) as any[];
  return (
    <section id="featured-research" className="home-section shell">
      <div className="flex items-end justify-between mb-12">
        <div>
          <div className="text-[10px] font-mono text-white/30 tracking-brutal uppercase mb-2">
            [002]
          </div>
          <GlassTitle>
            <h2 className="text-white">
              <SiteText page="home" name="featured_title">
                Featured Research
              </SiteText>
            </h2>
          </GlassTitle>
          <SiteText page="home" name="featured_subtitle"></SiteText>
          <div className="w-16 h-[2px] bg-white mt-4" />
        </div>
        <Link
          href="/research"
          className="text-white/40 hover:text-white text-xs font-mono font-bold tracking-brutal uppercase"
        >
          [VIEW ALL →]
        </Link>
      </div>

      <div className="home-research-grid">
        {projects.map((project, index) => (
          <ResearchCard key={project.id} project={project} index={index} />
        ))}
      </div>
    </section>
  );
}

async function PublicationsSection() {
  const publications = (await getDb().all(
    "SELECT * FROM publications WHERE status IN ('published', 'accepted') ORDER BY year DESC LIMIT 3",
  )) as any[];
  if (publications.length === 0) return null;
  return (
    <section className="home-section shell">
      <div className="flex items-end justify-between mb-12">
        <div>
          <div className="text-[10px] font-mono text-white/30 tracking-brutal uppercase mb-2">
            [003]
          </div>
          <GlassTitle>
            <h2 className="text-white">
              <SiteText page="home" name="publications_title">
                Publications
              </SiteText>
            </h2>
          </GlassTitle>
          <SiteText page="home" name="publications_subtitle"></SiteText>
          <div className="w-16 h-[2px] bg-white mt-4" />
        </div>
        <Link
          href="/publications"
          className="text-white/40 hover:text-white text-xs font-mono font-bold tracking-brutal uppercase"
        >
          [VIEW ALL →]
        </Link>
      </div>

      <div className="space-y-0">
        {publications.map((pub: any) => (
          <div
            key={pub.id}
            data-depth
            className="depth-plane liquid-surface border border-white/10 p-6 hover:border-white/30 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-brutal border ${
                  pub.status === "published"
                    ? "border-white text-white"
                    : pub.status === "accepted"
                      ? "border-white/60 text-white/60"
                      : "border-white/30 text-white/30"
                }`}
              >
                {pub.status}
              </span>
              <span className="text-[10px] text-white/30 font-mono">
                {pub.year}
              </span>
              {pub.journal && (
                <span className="text-[10px] text-white/30 font-mono">
                  — {pub.journal}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white uppercase tracking-tight">
              {pub.title}
            </h3>
            <p className="text-xs text-white/30 font-mono mt-1">
              {pub.authors}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

async function NotesSection() {
  const posts = (await getDb().all(
    `SELECT p.*, u.name as author_name FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.published = 1
      ORDER BY p.created_at DESC LIMIT 3`,
  )) as any[];
  if (posts.length === 0) return null;
  return (
    <section className="home-section shell">
      <div className="flex items-end justify-between mb-12">
        <div>
          <div className="text-[10px] font-mono text-white/30 tracking-brutal uppercase mb-2">
            [004]
          </div>
          <GlassTitle>
            <h2 className="text-white">
              <SiteText page="home" name="notes_title">
                Research Notes
              </SiteText>
            </h2>
          </GlassTitle>
          <SiteText page="home" name="notes_subtitle"></SiteText>
          <div className="w-16 h-[2px] bg-white mt-4" />
        </div>
        <Link
          href="/blog"
          className="text-white/40 hover:text-white text-xs font-mono font-bold tracking-brutal uppercase"
        >
          [VIEW ALL →]
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {posts.map((post: any) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="depth-card card-note home-note"
            data-depth
          >
            <h3 className="text-sm font-bold text-white mb-2 group-hover:text-white/70 transition-colors uppercase tracking-tight">
              {post.title}
            </h3>
            <p className="text-xs text-white/40 font-mono line-clamp-2">
              {post.excerpt}
            </p>
            <div className="mt-4 text-[10px] text-white/20 font-mono uppercase tracking-brutal">
              {new Date(post.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function HighlightsSection() {
  const timeline = await getDb()
    .all("SELECT * FROM timeline ORDER BY date DESC, sort_order ASC LIMIT 4")
    .catch(() => [] as any[]);
  if (timeline.length === 0) return null;
  return (
    <section
      className="home-section shell highlights-section"
      aria-label="Research highlights"
    >
      <div className="highlights-head flex items-end justify-between mb-12">
        <div>
          <div className="highlights-index text-[10px] font-mono text-white/30 tracking-brutal uppercase mb-2">
            [005]
          </div>
          <GlassTitle>
            <h2 className="text-white">Research highlights</h2>
          </GlassTitle>
          <div className="w-16 h-[2px] bg-white mt-4" />
        </div>
        <Link
          href="/timeline"
          className="highlights-link text-white/40 hover:text-white text-xs font-mono font-bold tracking-brutal uppercase"
        >
          [FULL TIMELINE →]
        </Link>
      </div>
      <ol className="grid md:grid-cols-2 gap-6">
        {timeline.map((t: any) => (
          <li
            key={t.id}
            data-depth
            className="depth-plane highlight-card border p-6"
          >
            <div className="highlight-meta text-[10px] font-mono uppercase tracking-brutal mb-2">
              {t.date} · {String(t.category || "").replaceAll("_", " ")}
            </div>
            <h3 className="text-sm font-bold uppercase tracking-tight mb-2">
              {t.title}
            </h3>
            <p className="highlight-body text-xs font-mono line-clamp-2">
              {t.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function Home() {
  // Hero-critical counts only: one tiny query gates the first byte.
  const counts = (await getDb().get(
    "SELECT (SELECT COUNT(*) FROM projects)::int AS projects, (SELECT COUNT(*) FROM theses)::int AS theses",
  )) as { projects: number; theses: number };

  return (
    <main className="min-h-screen bg-black">
      <div className="home-hero-layout">
        <ResearchHero
          projectCount={counts.projects}
          thesisCount={counts.theses}
        />

        <section className="home-anatomy shell" aria-label="Interactive anatomical scan">
          <XrayHero />
        </section>
      </div>

      {/* ═══ IMMERSIVE 3D RESEARCH LAB (HOME EXHIBIT) ═══ */}
      <Suspense fallback={null}>
        <LabSection />
      </Suspense>

      {/* ═══ FEATURED RESEARCH ═══ */}
      <Suspense fallback={null}>
        <FeaturedSection />
      </Suspense>

      {/* ═══ PUBLICATIONS ═══ */}
      <Suspense fallback={null}>
        <PublicationsSection />
      </Suspense>

      {/* ═══ RESEARCH NOTES ═══ */}
      <Suspense fallback={null}>
        <NotesSection />
      </Suspense>

      {/* ═══ RESEARCH HIGHLIGHTS / TIMELINE ═══ */}
      <Suspense fallback={null}>
        <HighlightsSection />
      </Suspense>

      {/* ═══ CTA ═══ */}
      <section className="home-section shell">
        <div
          data-depth
          className="depth-plane liquid-surface border p-12 text-center relative pane-frost"
        >
          {/* Corner screws */}
          <span
            aria-hidden="true"
            className="frost-screw absolute top-3 left-3"
            style={{ "--screw-angle": "38deg" } as CSSProperties}
          />
          <span
            aria-hidden="true"
            className="frost-screw absolute top-3 right-3"
            style={{ "--screw-angle": "-24deg" } as CSSProperties}
          />
          <span
            aria-hidden="true"
            className="frost-screw absolute bottom-3 left-3"
            style={{ "--screw-angle": "64deg" } as CSSProperties}
          />
          <span
            aria-hidden="true"
            className="frost-screw absolute bottom-3 right-3"
            style={{ "--screw-angle": "-52deg" } as CSSProperties}
          />

          <GlassTitle>
            <h2 className="mb-4">
              <SiteText page="home" name="cta_title">
                Collaboration
              </SiteText>
            </h2>
          </GlassTitle>
          <div className="w-16 h-[2px] bg-neutral-900 mx-auto mb-6" />
          <p className="mb-8 max-w-2xl mx-auto font-mono text-sm frost-body">
            <HyperSiteText
              page="home"
              name="cta_description"
              fallback="Open to research collaborations in biomedical imaging, optical diagnostics, and AI-driven medical applications."
            />
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <GalaxyButton
              href="/contact"
              seed={3}
              radius="0px"
              data-magnet
              className="interaction-magnetic px-6 py-3 bg-neutral-900 text-white text-xs font-mono font-bold tracking-brutal uppercase hover:bg-neutral-700 transition-colors"
            >
              <SiteText page="home" name="cta_button_text">
                [GET IN TOUCH →]
              </SiteText>
            </GalaxyButton>
            <GalaxyButton
              href="/publications"
              seed={4}
              radius="0px"
              className="px-6 py-3 border border-neutral-900/30 text-neutral-900 text-xs font-mono font-bold tracking-brutal uppercase hover:border-neutral-900/60 transition-colors"
            >
              [PUBLICATIONS]
            </GalaxyButton>
          </div>
        </div>
      </section>
    </main>
  );
}
