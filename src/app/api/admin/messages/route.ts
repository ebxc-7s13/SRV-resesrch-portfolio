import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { apiSuccess, apiError, apiPaginated } from "@/lib/api-utils";
import { withApi, pagination } from "@/lib/api-handler";
export const GET = withApi(async (request: NextRequest) => {
  await requireAdmin(request);
  const params = new URL(request.url).searchParams;
  const { page, limit, offset } = pagination(params);
  const where = params.get("unread") === "true" ? "WHERE read=0" : "";
  const db = getDb();
  const total = await db.get<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM messages ${where}`,
  );
  const rows = await db.all(
    `SELECT id,name,email,subject,read,created_at FROM messages ${where} ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return apiPaginated(rows, Number(total?.count || 0), page, limit);
});
export const PATCH = withApi(async (request: NextRequest) => {
  await requireAdmin(request);
  const { id } = await request.json();
  if (!Number.isSafeInteger(id) || id < 1)
    return apiError("A positive message ID is required");
  const result = await getDb().query(
    "UPDATE messages SET read=1 WHERE id=$1 RETURNING *",
    [id],
  );
  if (!result.rowCount) return apiError("Message not found", 404);
  return apiSuccess(result.rows[0]);
});
