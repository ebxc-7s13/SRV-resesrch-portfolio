import type { ArchiveKind, LabView, Vector } from "./lab-devices";

export type Station = {
  id: LabView;
  label: string;
  camera: Vector;
  target: Vector;
  position: Vector;
  rotation: Vector;
  description: string;
  archive?: ArchiveKind;
  color: string;
};
// Authored facility: 1 world unit = 1 metre.
// Room X [-5.5,5.5] (11m), Z [-4.2,4.2] (8.4m), wall height 2.9m.
// Bench height 0.9m, eye height 1.6m, aisles 1.6-2m for free movement.
// North wall (z=-4.2) is the archive/projector spine; south stays open
// behind the entry camera so the overview never clips a wall.
// Presentation coordinates, not measurements of a physical laboratory.
export const labStations: Station[] = [
  {
    id: "overview",
    label: "Entry / overview",
    camera: [0, 3, 3.6],
    target: [0, 1, -1.1],
    position: [0, 0, 4],
    rotation: [0, 0, 0],
    color: "#85d5ce",
    description:
      "Follow the guided route or choose a station on the floor plan.",
  },
  {
    id: "imaging",
    label: "Microscopy station",
    camera: [-1.4, 1.95, 1.7],
    target: [-3.7, 1.15, -1],
    position: [-3.7, 0, -1],
    rotation: [0, 0, 0],
    color: "#89cbc6",
    description:
      "Inspect the supplied microscope, image acquisition setup, and linked biomedical imaging research.",
  },
  {
    id: "engineering",
    label: "Microgravity bay",
    camera: [1.1, 2.05, 1.8],
    target: [3.35, 1.25, -1],
    position: [3.35, 0, -1],
    rotation: [0, 0, 0],
    color: "#dfa877",
    description:
      "Explore the supplied MMSA simulator, engineering figures, and actual experiment recordings.",
  },
  {
    id: "projects",
    label: "Project rack",
    camera: [-3, 1.85, 1.7],
    target: [-5, 1.25, 1.5],
    position: [-5, 0, 1.5],
    rotation: [0, Math.PI / 2, 0],
    archive: "projects",
    color: "#7eccc4",
    description:
      "Every research project has a folder. Select a spine to open its record and full case study.",
  },
  {
    id: "computational",
    label: "AI workstation",
    camera: [0, 1.9, 2.9],
    target: [0, 1.15, 0.5],
    position: [0, 0, 0.55],
    rotation: [0, 0, 0],
    color: "#9caee6",
    description:
      "Explore computational research through its actual figures, methods, and source records.",
  },
  {
    id: "publications",
    label: "Publication archive",
    camera: [-2.2, 1.75, -1.6],
    target: [-2.2, 1.4, -3.9],
    position: [-2.2, 0, -3.8],
    rotation: [0, 0, 0],
    archive: "publications",
    color: "#b5b5e1",
    description:
      "Open each paper to read its authors, venue, status, abstract, and available manuscript links.",
  },
  {
    id: "patents",
    label: "Patent cabinet",
    camera: [3.1, 1.75, -1.5],
    target: [3.1, 1.1, -3.85],
    position: [3.1, 0, -3.75],
    rotation: [0, 0, 0],
    archive: "patents",
    color: "#dcb182",
    description:
      "Explore engineering disclosures and their recorded filing status. No grant status is inferred.",
  },
  {
    id: "theses",
    label: "Thesis archive",
    camera: [-2.7, 1.85, 1.5],
    target: [-2.7, 1, 3.7],
    position: [-2.7, 0, 3.7],
    rotation: [0, Math.PI, 0],
    archive: "theses",
    color: "#c1a8cb",
    description:
      "Open the academic volumes for degree, institution, supervisor, and the original thesis page.",
  },
  {
    id: "notes",
    label: "Research notes",
    camera: [0.2, 1.85, 1.5],
    target: [0.2, 1, 3.7],
    position: [0.2, 0, 3.7],
    rotation: [0, Math.PI, 0],
    archive: "notes",
    color: "#a4c5aa",
    description:
      "Browse published laboratory notes and follow each notebook into its full article.",
  },
  {
    id: "desk",
    label: "Researcher desk",
    camera: [1.7, 1.9, 1],
    target: [3.4, 1, 2.9],
    position: [3.4, 0, 2.9],
    rotation: [0, -0.35, 0],
    color: "#d5b394",
    description:
      "Explore the researcher's existing capabilities, academic background, and research progression.",
  },
  {
    id: "projector",
    label: "Research projector",
    camera: [0.75, 1.95, 0.3],
    target: [0.75, 2, -4.1],
    position: [0.75, 2, -4.1],
    rotation: [0, 0, 0],
    color: "#8bd9dd",
    description:
      "Browse the complete project image collection with captions and links to its source projects.",
  },
  {
    id: "contact",
    label: "Contact terminal",
    camera: [2.9, 1.85, 3.1],
    target: [4.9, 1.15, 3.1],
    position: [4.9, 0, 3.1],
    rotation: [0, -Math.PI / 2, 0],
    color: "#b6d7c4",
    description:
      "Continue to the existing contact form to discuss research collaboration.",
  },
];
export const cameraTargets = Object.fromEntries(
  labStations.map((s) => [s.id, s]),
);
export const guidedRoute = [
  "overview",
  "projects",
  "imaging",
  "microscope",
  "engineering",
  "mmsa",
  "computational",
  "publications",
  "patents",
  "theses",
  "notes",
  "desk",
  "projector",
  "contact",
] as LabView[];
export const labPalette = {
  night: {
    floor: "#232f34",
    wall: "#2e4046",
    cabinet: "#33484e",
    trim: "#7fc4c6",
    paper: "#d8dfcf",
    light: "#9ddde7",
    ceiling: "#1d2a30",
    benchTop: "#3d4f45",
    benchEdge: "#c8cfbd",
    metal: "#8b9aa0",
    accentWarm: "#ffd9a8",
    accentCool: "#cfeef2",
  },
  day: {
    floor: "#c3cdc8",
    wall: "#dfe6dd",
    cabinet: "#a7bab4",
    trim: "#3f6675",
    paper: "#f4f0de",
    light: "#f9f3e3",
    ceiling: "#eef2ec",
    benchTop: "#5c6f66",
    benchEdge: "#e8ebdd",
    metal: "#7d8f95",
    accentWarm: "#fff0d6",
    accentCool: "#dceef2",
  },
  blossom: {
    floor: "#a89fa8",
    wall: "#d3c2cc",
    cabinet: "#a493ab",
    trim: "#7d5f86",
    paper: "#f0e6dd",
    light: "#efc5df",
    ceiling: "#e2d4dc",
    benchTop: "#5f5560",
    benchEdge: "#efe4da",
    metal: "#97879b",
    accentWarm: "#ffe3d2",
    accentCool: "#f3d8e8",
  },
};
