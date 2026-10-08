import { getDb } from "./db";
import {
  researchDevices,
  projectSections,
  type DeviceProject,
  type LabContent,
  type LabPatent,
  type LabPublication,
  type LabThesis,
  type LabNote,
  type LabMedia,
} from "./lab-devices";

export async function getLabContent(): Promise<LabContent> {
  try {
    const db = getDb();
    const hasSeeds = !!(
      await db.get<{ name: string | null }>(
        "SELECT to_regclass('public.seed_records')::text AS name",
      )
    )?.name;
    const devices = await Promise.all(
      researchDevices.map(async (device) => {
        const columns = [
          "id",
          "title",
          "slug",
          "status",
          "cover_image",
          ...projectSections.map(([key]) => key),
        ]
          .map((key) => `p.${key}`)
          .join(",");
        const project = await db.get<DeviceProject>(
          `SELECT ${columns} FROM projects p WHERE p.slug=$1 ${hasSeeds ? "OR p.id=(SELECT record_id FROM seed_records WHERE seed_key=$2)" : ""} ORDER BY p.id LIMIT 1`,
          hasSeeds
            ? [
                device.sourceSlug,
                "projects:" + JSON.stringify([device.sourceSlug]),
              ]
            : [device.sourceSlug],
        );
        const patentKeys = device.patentSeedTitles.map(
          (title) => "patents:" + JSON.stringify([title]),
        );
        const patents = await db.all<LabPatent>(
          `SELECT id,title,status,description,innovation FROM patents WHERE title=ANY($1::text[]) ${hasSeeds ? "OR id IN (SELECT record_id FROM seed_records WHERE seed_key=ANY($2::text[]))" : ""} ORDER BY sort_order,id`,
          hasSeeds
            ? [device.patentSeedTitles, patentKeys]
            : [device.patentSeedTitles],
        );
        const figure = project
          ? await db.get<{ file_path: string; caption: string | null }>(
              "SELECT file_path,caption FROM project_media WHERE project_id=$1 AND media_type='image' ORDER BY CASE WHEN section='hardware' THEN 0 ELSE 1 END,sort_order,id LIMIT 1",
              [project.id],
            )
          : null;
        return {
          id: device.id,
          project: project || null,
          patents,
          figure: figure || null,
        };
      }),
    );
    const publications = await db.all<LabPublication>(
      "SELECT id,title,authors,journal,year,status,abstract,doi,pdf_url FROM publications ORDER BY year DESC,sort_order,id",
    );
    const computationalSlugs = ["fascanet-denoising", "oral-cancer-afi"];
    const computationalProjects = await db.all<DeviceProject>(
      `SELECT id,title,slug,status,cover_image,${projectSections.map(([key]) => key).join(",")} FROM projects WHERE slug=ANY($1::text[]) ${hasSeeds ? "OR id IN (SELECT record_id FROM seed_records WHERE seed_key=ANY($2::text[]))" : ""} ORDER BY sort_order,id`,
      hasSeeds
        ? [
            computationalSlugs,
            computationalSlugs.map(
              (slug) => "projects:" + JSON.stringify([slug]),
            ),
          ]
        : [computationalSlugs],
    );
    // Explicit public columns: draft notes and private CMS fields never enter the scene payload.
    const [projects, patents, theses, notes, media] = await Promise.all([
      db.all<DeviceProject>(
        `SELECT id,title,slug,status,cover_image,${projectSections.map(([key]) => key).join(",")} FROM projects ORDER BY sort_order,id`,
      ),
      db.all<LabPatent>(
        "SELECT id,title,status,description,innovation FROM patents ORDER BY sort_order,id",
      ),
      db.all<LabThesis>(
        "SELECT id,title,degree,institution,supervisor,year,research_problem,objective,pdf_url FROM theses ORDER BY sort_order,id",
      ),
      db.all<LabNote>(
        "SELECT id,title,slug,excerpt,cover_image FROM posts WHERE published=1 ORDER BY published_at DESC,id DESC",
      ),
      db.all<LabMedia>(
        "SELECT m.id,m.project_id,m.file_path,m.media_type,m.caption,m.caption_title,p.title,p.slug,p.cover_image FROM project_media m JOIN projects p ON p.id=m.project_id WHERE m.media_type IN ('image','video') ORDER BY p.sort_order,p.id,m.sort_order,m.id",
      ),
    ]);
    return {
      devices,
      publications,
      computationalProjects,
      projects,
      patents,
      theses,
      notes,
      media,
      unavailable: false,
    };
  } catch {
    // The accessible entry points remain usable during a database outage.
    // Every array the UI reads must exist so optional-chained renderers
    // (content.projects, record.patents, media filters, …) never throw.
    return {
      devices: researchDevices.map((d) => ({
        id: d.id,
        project: null,
        patents: [],
        figure: null,
      })),
      publications: [],
      computationalProjects: [],
      projects: [],
      patents: [],
      theses: [],
      notes: [],
      media: [],
      unavailable: true,
    };
  }
}
