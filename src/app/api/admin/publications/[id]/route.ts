import { NextRequest } from "next/server";
import { requireAdmin, logAuditAction } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { withApi } from "@/lib/api-handler";
import { publicationSchema } from "@/lib/publication-schema";
type Context = { params: Promise<{ id: string }> };
export const PUT = withApi(
  async (request: NextRequest, { params }: Context) => {
    const user = await requireAdmin(request);
    const { id } = await params;
    const result = publicationSchema.safeParse(await request.json());
    if (!result.success) return apiError(result.error.errors[0].message);
    const d = result.data;
    const updated = await getDb().run(
      "UPDATE publications SET title=$1,authors=$2,journal=$3,year=$4,status=$5,doi=$6,abstract=$7,research_area=$8,pdf_url=$9,sort_order=$10 WHERE id=$11",
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
        id,
      ],
    );
    if (!updated.changes) return apiError("Publication not found", 404);
    await logAuditAction(user.id, "PUBLICATION_UPDATED", `publications:${id}`);
    return apiSuccess({ id });
  },
);
export const DELETE = withApi(
  async (request: NextRequest, { params }: Context) => {
    const user = await requireAdmin(request);
    const { id } = await params;
    const deleted = await getDb().run("DELETE FROM publications WHERE id=$1", [
      id,
    ]);
    if (!deleted.changes) return apiError("Publication not found", 404);
    await logAuditAction(user.id, "PUBLICATION_DELETED", `publications:${id}`);
    return apiSuccess({ id });
  },
);
