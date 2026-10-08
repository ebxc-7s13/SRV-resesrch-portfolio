import { NextRequest } from "next/server";
import { requireAdmin, logAuditAction } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { apiSuccess, apiPaginated, apiError } from "@/lib/api-utils";
import { withApi, pagination } from "@/lib/api-handler";
import { publicationSchema } from "@/lib/publication-schema";
export const GET = withApi(async (request: NextRequest) => {
  await requireAdmin(request);
  const { page, limit, offset } = pagination(new URL(request.url).searchParams);
  const db = getDb();
  const total = await db.get<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM publications",
  );
  return apiPaginated(
    await db.all(
      "SELECT * FROM publications ORDER BY sort_order,id LIMIT $1 OFFSET $2",
      [limit, offset],
    ),
    Number(total?.count || 0),
    page,
    limit,
  );
});
export const POST = withApi(async (request: NextRequest) => {
  const user = await requireAdmin(request);
  const result = publicationSchema.safeParse(await request.json());
  if (!result.success) return apiError(result.error.errors[0].message);
  const d = result.data;
  const inserted = await getDb().run(
    "INSERT INTO publications (title,authors,journal,year,status,doi,abstract,research_area,pdf_url,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [
      d.title,
      d.authors,
      d.journal,
      d.year,
      d.status,
      d.doi || null,
      d.abstract,
      d.research_area,
      d.pdf_url || null,
      d.sort_order,
    ],
  );
  await logAuditAction(
    user.id,
    "PUBLICATION_CREATED",
    `publications:${inserted.lastInsertRowid}`,
  );
  return apiSuccess({ id: inserted.lastInsertRowid }, 201);
});
