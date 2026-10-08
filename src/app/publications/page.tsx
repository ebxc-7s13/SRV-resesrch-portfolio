import { SiteText } from "@/components/SiteContent";
import { getDb } from "@/lib/db";
import { safeExternalHref } from "@/lib/safe-url";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import DepthCard from "@/components/ui/DepthCard";

export const metadata = {
  alternates: { canonical: "/publications" },
  title: "Publications",
  description:
    "Peer-reviewed manuscripts and research publications in biomedical imaging, deep learning, and cancer screening.",
};

// Database-backed content is rendered on demand so admin CMS edits are
// visible immediately and no database access happens at build time.
export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "under_review", label: "Under Review" },
  { value: "accepted", label: "Accepted" },
  { value: "published", label: "Published" },
  { value: "manuscript", label: "Manuscripts" },
  { value: "preprint", label: "Preprints" },
] as const;

export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const db = getDb();
  const params = await searchParams;
  const statusFilter = typeof params.status === "string" ? params.status : "";
  const isValidStatus = [
    "under_review",
    "accepted",
    "published",
    "manuscript",
    "preprint",
  ].includes(statusFilter);

  const allPublications = (await db.all(
    "SELECT * FROM publications ORDER BY year DESC, sort_order ASC",
  )) as any[];

  // Apply status filter when valid
  const publications = isValidStatus
    ? allPublications.filter((p: any) => p.status === statusFilter)
    : allPublications;

  // Only statuses that actually have records get a filter link, so the
  // list never offers a dead end. A direct URL to an emptied status still
  // resolves through the designed empty state below.
  const statusCounts = new Map<string, number>();
  for (const p of allPublications)
    statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);
  const visibleFilters = STATUS_FILTERS.filter(
    (filter) => !filter.value || (statusCounts.get(filter.value) ?? 0) > 0,
  );
  const underReview = publications.filter(
    (p: any) => !["published", "accepted"].includes(p.status),
  );
  const published = publications.filter(
    (p: any) => p.status === "published" || p.status === "accepted",
  );

  return (
    <main>
      <PageHeader
        index="03"
        label="Publication archive"
        title={
          <SiteText page="publications" name="hero_title">
            Publications & <span>Manuscripts</span>
          </SiteText>
        }
        description={
          <SiteText page="publications" name="hero_subtitle">
            Peer-reviewed manuscripts in biomedical imaging, deep learning, and
            cancer screening.
          </SiteText>
        }
      />
      <div className="shell archive-layout">
        <aside className="archive-rail">
          <div className="eyebrow">
            Archive / {allPublications.length} records
          </div>
          <p>Browse by publication status.</p>
          <nav
            className="filter-list"
            aria-label="Filter publications by status"
          >
            {visibleFilters.map((filter) => (
              <Link
                key={filter.value}
                href={
                  filter.value
                    ? `/publications?status=${filter.value}`
                    : "/publications"
                }
                aria-current={
                  statusFilter === filter.value ||
                  (!isValidStatus && !filter.value)
                    ? "true"
                    : undefined
                }
              >
                {filter.label}
                <span>
                  {filter.value
                    ? allPublications.filter((p) => p.status === filter.value)
                        .length
                    : allPublications.length}
                </span>
              </Link>
            ))}
          </nav>
        </aside>
        <div className="archive-records">
          {[
            { label: "Manuscripts", items: underReview },
            { label: "Published / Accepted", items: published },
          ]
            .filter((group) => group.items.length)
            .map((group) => (
              <section className="archive-group" key={group.label}>
                <div className="section-heading">
                  <h2>{group.label}</h2>
                  <span className="eyebrow">{group.items.length} records</span>
                </div>
                {group.items.map((pub) => (
                  <DepthCard
                    key={pub.id}
                    variant="publication"
                    className="publication-record"
                  >
                    <div className="document-spine" aria-hidden="true">
                      {pub.year}
                    </div>
                    <div className="document-body">
                      <div className="record-meta">
                        <span className="status-tag">
                          {pub.status.replaceAll("_", " ")}
                        </span>
                        <span>{pub.year}</span>
                      </div>
                      <h3>{pub.title}</h3>
                      <p className="record-authors">{pub.authors}</p>
                      {pub.journal && (
                        <p className="record-journal">{pub.journal}</p>
                      )}
                      {pub.abstract && (
                        <details className="reading-disclosure">
                          <summary>
                            Read abstract <span aria-hidden="true">+</span>
                          </summary>
                          <p>{pub.abstract}</p>
                        </details>
                      )}
                      <div className="record-links">
                        {pub.research_area && <span>{pub.research_area}</span>}
                        {safeExternalHref(pub.pdf_url) && (
                          <a
                            href={safeExternalHref(pub.pdf_url)!}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Read manuscript ↗
                          </a>
                        )}
                        {pub.doi && (
                          <a
                            href={`https://doi.org/${pub.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            DOI ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </DepthCard>
                ))}
              </section>
            ))}
          {!publications.length && (
            <div className="archive-empty">
              <h2>
                No {isValidStatus ? statusFilter.replaceAll("_", " ") : ""}{" "}
                publications right now.
              </h2>
              <Link className="button secondary" href="/publications">
                View all publications →
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
