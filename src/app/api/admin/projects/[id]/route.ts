import { withApi } from "@/lib/api-handler";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, logAuditAction } from "@/lib/auth";
import { validateBody, projectSchema } from "@/lib/validation";
import {
  apiSuccess,
  apiError,
  apiNotFound,
  apiUnauthorized,
  getClientIp,
} from "@/lib/api-utils";
import { generateSlug } from "@/lib/validation";

export const GET = withApi(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin(request);
  const { id } = await params;
  const db = getDb();
  const project = await db.get("SELECT * FROM projects WHERE id = $1", [id]);
  if (!project) return apiNotFound("Project not found");
  return apiSuccess(project);
});

export const PUT = withApi(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireAdmin(request);

  const validation = await validateBody(request, projectSchema);
  if (!validation.success) return apiError(validation.error);

  const data = validation.data;
  const slug = data.slug || generateSlug(data.title);

  const db = getDb();
  const existing = await db.get("SELECT id FROM projects WHERE id = $1", [id]);
  if (!existing) return apiNotFound("Project not found");

  // Check slug uniqueness (exclude current)
  const slugConflict = await db.get(
    "SELECT id FROM projects WHERE slug = $1 AND id != $2",
    [slug, id],
  );
  if (slugConflict) return apiError("A project with this slug already exists");

  await db.run(
    `
    UPDATE projects SET
      title = $1, slug = $2, research_problem = $3, motivation = $4, approach = $5,
      methodology = $6, experimental_setup = $7, hardware = $8, data_acquisition = $9,
      computational_method = $10, results = $11, key_contribution = $12, status = $13,
      featured = $14, sort_order = $15, cover_image = $16, updated_at = NOW()
    WHERE id = $17
  `,
    [
      data.title,
      slug,
      data.research_problem,
      data.motivation,
      data.approach,
      data.methodology || "",
      data.experimental_setup || "",
      data.hardware || "",
      data.data_acquisition || "",
      data.computational_method || "",
      data.results,
      data.key_contribution,
      data.status,
      data.featured ? 1 : 0,
      data.sort_order,
      data.cover_image || null,
      id,
    ],
  );

  await logAuditAction(
    user.id,
    "PROJECT_UPDATED",
    `projects:${id}`,
    getClientIp(request),
  );
  return apiSuccess({ message: "Project updated" });
});

export const DELETE = withApi(async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireAdmin(request);

  const db = getDb();
  const existing = await db.get("SELECT id FROM projects WHERE id = $1", [id]);
  if (!existing) return apiNotFound("Project not found");

  await db.run("DELETE FROM projects WHERE id = $1", [id]);
  await logAuditAction(
    user.id,
    "PROJECT_DELETED",
    `projects:${id}`,
    getClientIp(request),
  );
  return apiSuccess({ message: "Project deleted" });
});
