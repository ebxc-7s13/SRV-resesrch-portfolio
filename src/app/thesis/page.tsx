import { SiteText } from "@/components/SiteContent";
import { getDb } from "@/lib/db";
import ThesisFlow from "@/components/ThesisFlow";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = {
  alternates: { canonical: "/thesis" },
  title: "Theses",
  description:
    "M.Tech and B.Tech thesis research in biomedical imaging, optical systems, and computational diagnostics.",
};

// Database-backed content is rendered on demand so admin CMS edits are
// visible immediately and no database access happens at build time.
export const dynamic = "force-dynamic";

export default async function ThesisPage() {
  const db = getDb();
  const theses = (await db.all(
    "SELECT * FROM theses ORDER BY sort_order ASC",
  )) as any[];

  return (
    <main>
      <PageHeader
        index="04"
        label="Academic research"
        title={
          <SiteText page="thesis" name="hero_title">
            Research <span>Theses</span>
          </SiteText>
        }
        description={
          <SiteText page="thesis" name="hero_subtitle">
            M.Tech and B.Tech thesis research spanning biomedical imaging,
            optical instrumentation, and computational methods for disease
            detection.
          </SiteText>
        }
      />
      <section className="shell thesis-archive">
        <nav className="thesis-index" aria-label="Thesis index">
          {theses.map((thesis) => (
            <a key={thesis.id} href={`#thesis-${thesis.id}`}>
              <span>
                {thesis.degree} / {thesis.year}
              </span>
              {thesis.title}
              <b aria-hidden="true">↓</b>
            </a>
          ))}
        </nav>
        {theses.map((thesis) => (
          <article
            className="thesis-record"
            id={`thesis-${thesis.id}`}
            key={thesis.id}
          >
            <header className="thesis-cover" data-depth>
              <div className="eyebrow">Research thesis</div>
              <span className="thesis-degree">{thesis.degree}</span>
              <h2>{thesis.title}</h2>
              <dl className="record-facts">
                <div>
                  <dt>Institution</dt>
                  <dd>{thesis.institution}</dd>
                </div>
                <div>
                  <dt>Supervisor</dt>
                  <dd>{thesis.supervisor}</dd>
                </div>
                <div>
                  <dt>Year</dt>
                  <dd>{thesis.year}</dd>
                </div>
              </dl>
            </header>
            <div className="thesis-chapters">
              <div className="eyebrow">Read the study</div>
              <ThesisFlow thesis={thesis} />
            </div>
          </article>
        ))}
        {!theses.length && (
          <p className="archive-empty">
            Thesis records will appear here when available.
          </p>
        )}
      </section>
    </main>
  );
}
