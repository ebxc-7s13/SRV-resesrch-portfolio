import { withApi } from "@/lib/api-handler";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, logAuditAction } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiNotFound,
  apiUnauthorized,
  getClientIp,
} from "@/lib/api-utils";
import { sanitize } from "@/lib/validation";
import { z } from "zod";
import { isLocalMedia } from "@/lib/media";

const mediaSchema = z
  .object({
    project_id: z.number().int().positive(),
    file_path: z.string().min(1).max(500),
    media_type: z.enum(["image", "video", "document"]),
    caption: z.string().max(500).optional().default("").transform(sanitize),
    caption_title: z
      .string()
      .max(300)
      .optional()
      .default("")
      .transform(sanitize),
    section: z
      .enum([
        "",
        "research_problem",
        "motivation",
        "approach",
        "methodology",
        "experimental_setup",
        "hardware",
        "data_acquisition",
        "computational_method",
        "results",
        "key_contribution",
      ])
      .default(""),
    sort_order: z.number().int().min(0).max(1000).default(0),
  })
  .refine(
    (d) => isLocalMedia(d.file_path, d.media_type),
    "Choose an existing research file matching the media type (images, MP4/WebM or PDF)",
  );

export const GET = withApi(async function GET(request: NextRequest) {
  await requireAdmin(request);
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  const db = getDb();

  let media;
  if (projectId) {
    media = await db.all(
      "SELECT * FROM project_media WHERE project_id = $1 ORDER BY sort_order ASC",
      [projectId],
    );
  } else {
    media = await db.all(
      "SELECT pm.*, p.slug as project_slug FROM project_media pm JOIN projects p ON pm.project_id = p.id ORDER BY pm.sort_order ASC",
    );
  }
  return apiSuccess(media);
});

export const POST = withApi(async function POST(request: NextRequest) {
  const user = await requireAdmin(request);

  const body = await request.json();
  const validation = mediaSchema.safeParse(body);
  if (!validation.success) return apiError(validation.error.errors[0].message);

  const d = validation.data;
  const db = getDb();
  const result = await db.run(
    "INSERT INTO project_media (project_id, file_path, media_type, caption, caption_title, section, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [
      d.project_id,
      d.file_path,
      d.media_type,
      d.caption || "",
      d.caption_title || "",
      d.section || "",
      d.sort_order,
    ],
  );

  await logAuditAction(
    user.id,
    "MEDIA_CREATED",
    `media:${result.lastInsertRowid}`,
    getClientIp(request),
  );
  return apiSuccess({ id: result.lastInsertRowid }, 201);
});

export const DELETE = withApi(async function DELETE(request: NextRequest) {
  const user = await requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return apiError("ID required");

  const db = getDb();
  await db.run("DELETE FROM project_media WHERE id = $1", [id]);
  await logAuditAction(
    user.id,
    "MEDIA_DELETED",
    `media:${id}`,
    getClientIp(request),
  );
  return apiSuccess({ message: "Deleted" });
});
