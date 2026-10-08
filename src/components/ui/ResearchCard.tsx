import Image from "next/image";
import Link from "next/link";
import DepthCard from "./DepthCard";
export interface ResearchCardData {
  id: number;
  slug: string;
  title: string;
  status: string;
  cover_image?: string | null;
  research_problem?: string | null;
  results?: string | null;
  media_count?: number;
}
export default function ResearchCard({
  project,
  index = 0,
}: {
  project: ResearchCardData;
  index?: number;
}) {
  return (
    <DepthCard variant="research">
      <Link href={`/research/${project.slug}`} className="research-card-link">
        <div className="research-card-media">
          {project.cover_image ? (
            <Image
              src={project.cover_image}
              alt={project.title}
              fill
              sizes="(max-width: 700px) 90vw, (max-width: 1100px) 45vw, 540px"
              className="research-card-image"
            />
          ) : (
            <div className="media-placeholder">Research case study</div>
          )}
          <span className="figure-index">
            {String(index + 1).padStart(2, "0")} / RESEARCH
          </span>
          <span className="media-action" aria-hidden="true">
            ↗
          </span>
        </div>
        <div className="research-card-body">
          <div className="card-metadata">
            <span className="status-tag">
              {project.status.replaceAll("_", " ")}
            </span>
            {typeof project.media_count === "number" && (
              <span>{project.media_count} figures & media</span>
            )}
          </div>
          <h2>{project.title}</h2>
          {project.research_problem && (
            <p className="research-card-summary">{project.research_problem}</p>
          )}
          <span className="card-open">
            Explore case study <span aria-hidden="true">↗</span>
          </span>
        </div>
      </Link>
    </DepthCard>
  );
}
