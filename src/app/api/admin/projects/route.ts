import { withApi, pagination } from "@/lib/api-handler";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, logAuditAction } from "@/lib/auth";
import { validateBody, projectSchema } from "@/lib/validation";
import {
  apiPaginated,
  apiSuccess,
  apiError,
  apiUnauthorized,
  getClientIp,
} from "@/lib/api-utils";
import { generateSlug } from "@/lib/validation";

// GET: List all projects
export const GET = withApi(async function GET(request: NextRequest) {
  await requireAdmin(request);
  const { page, limit, offset } = pagination(new URL(request.url).searchParams);
  const db = getDb();
  const total = await db.get<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM projects",
  );
  const rows = await db.all(
    "SELECT * FROM projects ORDER BY sort_order, id LIMIT $1 OFFSET $2",
    [limit, offset],
  );
  return apiPaginated(rows, Number(total?.count || 0), page, limit);
});

// POST: Create a new project
export const POST = withApi(async function POST(request: NextRequest) {
  const user = await requireAdmin(request);

  const validation = await validateBody(request, projectSchema);
  if (!validation.success) {
    return apiError(validation.error);
  }

  const data = validation.data;
  const slug = data.slug || generateSlug(data.title);

  const db = getDb();
  try {
    const result = await db.run(
      `INSERT INTO projects (title, slug, research_problem, motivation, approach, methodology, experimental_setup, hardware, data_acquisition, computational_method, results, key_contribution, status, featured, sort_order, cover_image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        data.title,
        slug,
        data.research_problem,
        data.motivation,
        data.approach,
        data.methodology,
        data.experimental_setup,
        data.hardware,
        data.data_acquisition,
        data.computational_method,
        data.results,
        data.key_contribution,
        data.status,
        data.featured ? 1 : 0,
        data.sort_order,
        data.cover_image || null,
      ],
    );

    await logAuditAction(
      user.id,
      "PROJECT_CREATED",
      `projects:${result.lastInsertRowid}`,
      getClientIp(request),
    );

    return apiSuccess({ id: result.lastInsertRowid }, 201);
  } catch (error) {
    return apiError("Failed to create project");
  }
});
