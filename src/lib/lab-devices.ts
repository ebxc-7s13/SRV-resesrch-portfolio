export type DeviceId = "microscope" | "mmsa";
export type LabView =
  | "overview"
  | "imaging"
  | "engineering"
  | "publications"
  | "computational"
  | "projects"
  | "patents"
  | "theses"
  | "notes"
  | "desk"
  | "contact"
  | "projector"
  | DeviceId;
export type Quality = "high" | "medium" | "low";
export type Vector = [number, number, number];

// Content identities were verified in scripts/seed.ts. seed_records preserves
// these links if an administrator changes a project title or slug.
export const researchDevices = [
  {
    id: "microscope" as const,
    title: "Microscope",
    bay: "Biomedical imaging",
    contentType: "project" as const,
    sourceSlug: "oncospectrix-microscope",
    asset: "/3d/microscopes/microscope.glb",
    mediumAsset: "/3d/microscopes/microscope.glb",
    lowAsset: "/3d/microscopes/microscope.glb",
    preview: "/3d/microscopes/preview.webp?v=20260914",
    position: [-3.7, 0.9, -1] as Vector,
    scale: 0.86,
    rotation: [0, 0.35, 0] as Vector,
    target: [-3.7, 1.32, -1] as Vector,
    camera: [-2.2, 1.75, 0.6] as Vector,
    minDistance: 1.05,
    maxDistance: 3.5,
    patentSeedTitles: [
      "Label-free Autofluorescence Imaging Device & AI-based Screening Method for Oral Cancer",
    ],
  },
  {
    id: "mmsa" as const,
    title: "Microgravity Simulator",
    bay: "Microgravity research",
    contentType: "project" as const,
    sourceSlug: "microgravity-platform",
    asset: "/3d/microgravity/mmsa.glb",
    mediumAsset: "/3d/microgravity/mmsa-medium.glb",
    lowAsset: "/3d/microgravity/mmsa-low.glb",
    preview: "/3d/microgravity/preview.webp?v=20260914",
    position: [3.35, 0.92, -1] as Vector,
    scale: 1.85,
    rotation: [0, -0.08, 0] as Vector,
    target: [3.35, 1.6, -1] as Vector,
    camera: [3.35, 2, 1.6] as Vector,
    minDistance: 2.2,
    maxDistance: 5.7,
    patentSeedTitles: [
      "Automated Multi-Modal Microgravity-on-a-Chip Simulation Platform",
    ],
  },
] as const;

export const projectSections = [
  ["research_problem", "Research problem"],
  ["motivation", "Purpose & motivation"],
  ["approach", "System / platform"],
  ["methodology", "Methodology"],
  ["hardware", "Engineering design"],
  ["experimental_setup", "Experimental setup"],
  ["data_acquisition", "Data acquisition"],
  ["computational_method", "Computational method"],
  ["results", "Results"],
  ["key_contribution", "Research contribution"],
] as const;
export type ProjectSection = (typeof projectSections)[number][0];
export type DeviceProject = {
  id: number;
  slug: string;
  title: string;
  status: string;
  cover_image: string | null;
} & Record<ProjectSection, string | null>;
export type LabPublication = {
  id: number;
  title: string;
  authors: string;
  journal: string;
  year: number;
  status: string;
  abstract: string | null;
  doi: string | null;
  pdf_url: string | null;
};
export type LabPatent = {
  id: number;
  title: string;
  status: string;
  description: string;
  innovation: string;
};
export type LabContent = {
  devices: {
    id: DeviceId;
    project: DeviceProject | null;
    patents: LabPatent[];
    figure: { file_path: string; caption: string | null } | null;
  }[];
  publications: LabPublication[];
  computationalProjects?: DeviceProject[];
  projects?: DeviceProject[];
  patents?: LabPatent[];
  theses?: LabThesis[];
  notes?: LabNote[];
  media?: LabMedia[];
  unavailable: boolean;
};

export type LabThesis = {
  id: number;
  title: string;
  degree: string;
  institution: string;
  supervisor: string;
  year: string;
  research_problem: string;
  objective: string;
  pdf_url: string | null;
};
export type LabNote = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image: string | null;
};
export type LabMedia = {
  id: number;
  project_id: number;
  file_path: string;
  media_type: "image" | "video";
  caption: string | null;
  caption_title: string | null;
  title: string;
  slug: string;
  cover_image: string | null;
};
export type ArchiveKind =
  | "projects"
  | "publications"
  | "patents"
  | "theses"
  | "notes";
export type ArchiveSelection = { kind: ArchiveKind; id: number };
