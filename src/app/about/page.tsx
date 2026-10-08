import { skillGroups } from "@/lib/research-skills";
import { SiteText } from "@/components/SiteContent";
import { getDb } from "@/lib/db";
import PageHeader from "@/components/ui/PageHeader";
import HyperSiteText from "@/components/ui/hyper-site-text";
import DepthCard from "@/components/ui/DepthCard";
import GlassTitle from "@/components/GlassTitle";

export const metadata = {
  alternates: { canonical: "/about" },
  title: "About",
  description:
    "Academic background, research interests, and technical expertise of Raja Viveka Vardhan Siluveru in biomedical imaging, optical systems, and AI-driven diagnostics.",
};

// Database-backed content is rendered on demand so admin CMS edits are
// visible immediately and no database access happens at build time.
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const db = getDb();
  // Get research themes from DB
  const themes = (await db.all(
    "SELECT * FROM research_themes ORDER BY sort_order ASC",
  )) as any[];

  return (
    <main className="min-h-screen bg-slate-950">
      <PageHeader
        index="08"
        label="About the researcher"
        title={
          <>
            Siluveru <span>Raja Viveka Vardhan</span>
          </>
        }
        description={
          <SiteText page="about" name="hero_subtitle">
            Biomedical Engineering Researcher working at the intersection of
            optical imaging, AI/ML, and non-invasive diagnostics. M.Tech Gold
            Medallist at IIEST Shibpur with a focus on label-free oral cancer
            detection using multispectral imaging and deep learning.
          </SiteText>
        }
      />
      <section className="shell researcher-intro">
        <div className="identity-object" aria-hidden="true">
          <div className="identity-orbit orbit-one" />
          <div className="identity-orbit orbit-two" />
          <div className="identity-orbit orbit-three" />
          <strong>SRV</strong>
          <span>IMAGING / COMPUTATION / ENGINEERING</span>
        </div>
        <div>
          <div className="eyebrow">From instrument to insight</div>
          <p>
            <HyperSiteText
              page="about"
              name="hero_description"
              fallback="My research addresses the critical need for accessible, non-invasive diagnostic tools — particularly for resource-limited settings where conventional biopsy-based methods are impractical. I develop complete experimental systems from hardware instrumentation through computational analysis."
            />
          </p>
          <a className="text-link" href="#capabilities">
            Explore technical expertise ↓
          </a>
        </div>
      </section>
      {/* Academic Background */}
      <section className="shell about-section academic-background">
        <GlassTitle>
          <h2 className="text-3xl font-bold text-white mb-12">
            Academic Background
          </h2>
        </GlassTitle>
        <div className="space-y-6">
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                <span className="academic-mark" aria-hidden="true">
                  ↗
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  M.Tech — Biomedical Engineering
                </h3>
                <p className="text-indigo-400 font-medium">
                  IIEST Shibpur, Centre for Healthcare Science and Technology
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  2024 – 2026 · CGPA: 9.93/10 · University Gold Medallist
                </p>
                <p className="text-slate-400 mt-3 leading-relaxed">
                  Thesis: &quot;A Non-Invasive AI-Based Framework for Early Oral
                  Cancer Detection Using Autofluorescence Imaging&quot; —
                  Developing a unified AFI pipeline with FASCANet denoising,
                  StyleGAN2 synthetic augmentation, and AFiS-Net classification.
                </p>
                <p className="text-slate-500 text-sm mt-2">
                  Supervisor: Dr. Ananya Barui
                </p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <span className="academic-mark" aria-hidden="true">
                  ↗
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  B.Tech — Biomedical Engineering
                </h3>
                <p className="text-emerald-400 font-medium">
                  NIT Rourkela, Dept. of Biotechnology &amp; Medical Engineering
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  2018 – 2022 · CGPA: 8.55/10
                </p>
                <p className="text-slate-400 mt-3 leading-relaxed">
                  Thesis: &quot;Differentiating Cannabis-Consuming Population
                  from Non-Consumers using ECG Morphological Features through
                  Machine Learning Models&quot;
                </p>
                <p className="text-slate-500 text-sm mt-2">
                  Supervisor: Dr. J. Sivaraman
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {themes.length > 0 && (
        <section className="shell about-section">
          <div className="section-heading">
            <h2>Research themes</h2>
            <span className="eyebrow">Areas of inquiry</span>
          </div>
          <div className="theme-map">
            {themes.map((theme, index) => (
              <DepthCard key={theme.id} variant="research">
                <span className="index-mark">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{theme.title}</h3>
                <p>{theme.description}</p>
              </DepthCard>
            ))}
          </div>
        </section>
      )}
      <section className="shell about-section" id="capabilities">
        <div className="section-heading">
          <h2>Technical expertise</h2>
          <span className="eyebrow">Methods & tools</span>
        </div>
        <div className="capability-map">
          {Object.entries(skillGroups).map(([category, skills], index) => (
            <DepthCard key={category} variant="device">
              <div className="eyebrow">
                <span className="capability-index">
                  {String(index + 1).padStart(2, "0")}
                </span>{" "}
                / Capability
              </div>
              <h3>{category}</h3>
              <ul>
                {skills.map((skill) => (
                  <li key={skill.name}>
                    <span>{skill.name}</span>
                  </li>
                ))}
              </ul>
            </DepthCard>
          ))}
        </div>
      </section>
      {/* Research Philosophy */}
      <section className="shell about-section">
        <div
          data-day-philosophy
          data-reveal
          data-pointer
          className="philosophy-panel"
        >
          <div className="philosophy-mark" aria-hidden="true">
            <svg
              className="philosophy-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              focusable="false"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <blockquote className="philosophy-quote">
            <HyperSiteText
              page="about"
              name="philosophy_quote"
              fallback={'"I believe the most impactful research develops complete systems — from the physical measurement instrument through the computational pipeline to the clinical decision. My work aims to bridge the gap between laboratory research and deployable diagnostic tools, particularly for communities that need them most."'}
            />
          </blockquote>
          <p className="philosophy-attribution">— Research Philosophy</p>
        </div>
      </section>
    </main>
  );
}
