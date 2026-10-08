import { projectSections, type DeviceProject } from "./lab-devices";
import { skillGroups } from "./research-skills";

const normalize = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;

// Display only literal mentions in public project text, never inferred expertise.
export function projectsMentioningSkills(
  projects: DeviceProject[],
  group: string,
) {
  return projects.flatMap((project) => {
    const text = normalize(
      [
        project.title,
        ...projectSections.map(([key]) => project[key] || ""),
      ].join(" "),
    );
    const mentions = (skillGroups[group] || [])
      .filter((skill) => {
        const terms = [
          skill.name.replace(/\s*\(.*\)/, ""),
          skill.name.match(/\(([^)]+)\)/)?.[1],
        ];
        return terms.some(
          (term) =>
            term && /[a-z]/i.test(term) && text.includes(normalize(term)),
        );
      })
      .map((skill) => skill.name);
    return mentions.length ? [{ project, mentions }] : [];
  });
}
