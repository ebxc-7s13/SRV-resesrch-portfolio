import type { LabView, Vector } from "./lab-devices";
export const capabilityStations: {
  group: string;
  view: LabView;
  position: Vector;
  label: string;
}[] = [
  {
    group: "Research Methods",
    view: "desk",
    position: [3.3, 0.92, 3.1],
    label: "Research methods / notebooks",
  },
  {
    group: "Imaging & Instrumentation",
    view: "imaging",
    position: [-4.6, 0.92, -0.35],
    label: "Imaging / instrument modules",
  },
  {
    group: "AI / Computational Methods",
    view: "computational",
    position: [-0.62, 0.98, 0.75],
    label: "Computational methods / modules",
  },
  {
    group: "Hardware / Prototyping",
    view: "engineering",
    position: [4.35, 0.92, -0.4],
    label: "Prototyping / instrument modules",
  },
  {
    group: "Software",
    view: "computational",
    position: [0.55, 0.98, 0.75],
    label: "Software / workstation modules",
  },
];
