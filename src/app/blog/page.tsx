import { getDb } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import PageHeader from "@/components/ui/PageHeader";

export const metadata = {
  alternates: { canonical: "/blog" },
  title: "Research Notes",
  description:
    "Technical notes on biomedical imaging, optical systems, AI/ML methods, and experimental research.",
};

// Database-backed content is rendered on demand so admin CMS edits are
// visible immediately and no database access happens at build time.
export const dynamic = "force-dynamic";

export default async function ResearchNotesPage() {
  const db = getDb();
  const posts = (await db.all(
    `SELECT p.*, u.name as author_name FROM posts p
     LEFT JOIN users u ON p.author_id = u.id
     WHERE p.published = 1
     ORDER BY p.created_at DESC`,
  )) as any[];

  return (
    <main>
      <PageHeader
        index="07"
        label="Research notebook"
        title={
          <>
            Research <span>Notes</span>
          </>
        }
        description="Technical observations, methodology notes, experimental insights, and research progress updates."
      />
      <section className="shell notes-archive">
        <div className="eyebrow">{posts.length} published notes</div>
        {posts.map((post, index) => (
          <article
            className="note-record depth-card card-note"
            data-depth
            key={post.id}
          >
            <span className="note-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="record-meta">
                <span>{post.author_name || "Researcher"}</span>
                <time dateTime={new Date(post.created_at).toISOString()}>
                  {new Date(post.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </time>
              </div>
              <h2>
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </h2>
              <p>{post.excerpt}</p>
              <Link className="text-link" href={`/blog/${post.slug}`}>
                Read note ↗
              </Link>
            </div>
            {post.cover_image && (
              <Image
                src={post.cover_image}
                alt={post.title}
                width={300}
                height={200}
                sizes="(max-width:768px) 85vw, 220px"
              />
            )}
          </article>
        ))}
        {!posts.length && (
          <div className="archive-empty">
            <h2>No notes yet</h2>
            <p>Research notes will appear here as they are published.</p>
          </div>
        )}
      </section>
    </main>
  );
}
