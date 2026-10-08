import {
  projectSections,
  type ArchiveKind,
  type LabContent,
} from "./lab-devices";

export type ArchiveRecord = {
  id: number;
  title: string;
  label: string;
  text: string;
  href: string;
  image?: string | null;
  details: [string, string][];
};
export function archiveRecords(
  content: LabContent,
  kind: ArchiveKind,
): ArchiveRecord[] {
  switch (kind) {
    case "projects":
      return (content.projects || []).map((p) => ({
        id: p.id,
        title: p.title,
        label: p.status.replaceAll("_", " "),
        text: p.research_problem || "",
        href: `/research/${p.slug}`,
        image: p.cover_image,
        details: projectSections.flatMap(([key, label]) =>
          p[key] ? [[label, p[key]!] as [string, string]] : [],
        ),
      }));
    case "publications":
      return content.publications.map((p) => ({
        id: p.id,
        title: p.title,
        label: `${p.year} / ${p.status.replaceAll("_", " ")}`,
        text: p.abstract || "",
        href: "/publications",
        details: [
          ["Authors", p.authors],
          ["Venue", p.journal],
        ],
      }));
    case "patents":
      return (content.patents || []).map((p) => ({
        id: p.id,
        title: p.title,
        label: p.status.replaceAll("_", " "),
        text: p.description,
        href: "/patents",
        details: [["Innovation", p.innovation]],
      }));
    case "theses":
      return (content.theses || []).map((p) => ({
        id: p.id,
        title: p.title,
        label: `${p.degree} / ${p.year}`,
        text: p.research_problem,
        href: `/thesis#thesis-${p.id}`,
        details: [
          ["Institution", p.institution],
          ["Supervisor", p.supervisor],
          ["Objective", p.objective],
        ],
      }));
    case "notes":
      return (content.notes || []).map((p) => ({
        id: p.id,
        title: p.title,
        label: "Published research note",
        text: p.excerpt,
        href: `/blog/${p.slug}`,
        image: p.cover_image,
        details: [],
      }));
  }
}
