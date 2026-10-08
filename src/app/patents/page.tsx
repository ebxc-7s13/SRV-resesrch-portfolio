import Link from "next/link";
import { SiteText } from "@/components/SiteContent";
import { getDb } from "@/lib/db";
import PageHeader from "@/components/ui/PageHeader";
import DepthCard from "@/components/ui/DepthCard";
import { getLabContent } from "@/lib/lab-content";
import Image from "next/image";

export const metadata = {
  alternates: { canonical: "/patents" },
  title: "Patents & Technology",
  description:
    "Research innovation and technology disclosure records in biomedical and optical engineering.",
};

// Database-backed content is rendered on demand so admin CMS edits are
// visible immediately and no database access happens at build time.
export const dynamic = "force-dynamic";

export default async function PatentsPage() {
  const db = getDb();
  // Independent reads share one round-trip batch instead of two sequential
  // awaits (the device lookup below only needs both result sets).
  const [patents, lab] = await Promise.all([
    db.all("SELECT * FROM patents ORDER BY sort_order ASC") as Promise<any[]>,
    getLabContent(),
  ]);
  return (
    <main>
      <PageHeader
        index="05"
        label="Technology disclosures"
        title={
          <SiteText page="patents" name="hero_title">
            Patents & <span>Innovations</span>
          </SiteText>
        }
        description={
          <SiteText page="patents" name="hero_subtitle">
            Novel technologies and engineering systems developed through
            interdisciplinary research.
          </SiteText>
        }
      />
      <section className="shell patent-archive">
        {patents.map((patent, index) => {
          const device = lab.devices.find((d) =>
            d.patents.some((p) => p.id === patent.id),
          );
          return (
            <DepthCard
              key={patent.id}
              variant="patent"
              className="patent-record"
            >
              <div className="patent-drawing">
                <div className="eyebrow">
                  Archive record {String(index + 1).padStart(2, "0")}
                </div>
                {device?.project?.cover_image ? (
                  <Image
                    src={device.project.cover_image}
                    alt={device.project.title}
                    width={640}
                    height={480}
                    sizes="(max-width:768px) 90vw, 400px"
                  />
                ) : (
                  <div className="patent-document-mark" aria-hidden="true">
                    IP
                  </div>
                )}
                <span>
                  {device?.project
                    ? "Associated research figure"
                    : "Technology disclosure"}
                </span>
              </div>
              <div className="patent-body">
                <span className="status-tag">
                  {patent.status.replaceAll("_", " ")}
                </span>
                <h2>{patent.title}</h2>
                <p>{patent.description}</p>
                <dl className="record-facts">
                  {patent.inventors && (
                    <div>
                      <dt>Inventors</dt>
                      <dd>{patent.inventors}</dd>
                    </div>
                  )}
                  {patent.applicant && (
                    <div>
                      <dt>Applicant</dt>
                      <dd>{patent.applicant}</dd>
                    </div>
                  )}
                </dl>
                {patent.innovation && (
                  <details className="reading-disclosure">
                    <summary>
                      Key innovation <span aria-hidden="true">+</span>
                    </summary>
                    <p>{patent.innovation}</p>
                  </details>
                )}
                <div className="record-links">
                  {patent.research_area && <span>{patent.research_area}</span>}
                  {device?.project && (
                    <Link href={`/research/${device.project.slug}`}>
                      Read the associated case study ↗
                    </Link>
                  )}
                </div>
              </div>
            </DepthCard>
          );
        })}
        {!patents.length && (
          <div className="archive-empty">
            <h2>Patent portfolio</h2>
            <p>
              Technology disclosures and patent applications will be listed here
              as they are filed.
            </p>
          </div>
        )}
        <Link className="text-link" href="/research">
          Explore research case studies →
        </Link>
      </section>
    </main>
  );
}
