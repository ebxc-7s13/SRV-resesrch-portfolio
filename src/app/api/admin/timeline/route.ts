import { withApi, pagination } from "@/lib/api-handler";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, logAuditAction } from "@/lib/auth";
import {
  apiPaginated,
  apiSuccess,
  apiError,
  apiUnauthorized,
  getClientIp,
} from "@/lib/api-utils";
import { sanitize } from "@/lib/validation";
import { z } from "zod";

const timelineSchema = z.object({
  title: z.string().min(1).max(300).transform(sanitize),
  description: z.string().min(1).max(2000).transform(sanitize),
  date: z.string().min(1).max(50).transform(sanitize),
  category: z.enum([
    "education",
    "research",
    "publication",
    "patent",
    "project",
    "startup",
    "award",
  ]),
  icon: z.string().max(10).optional().default(""),
  sort_order: z.number().int().min(0).max(1000).default(0),
});

export const GET = withApi(async function GET(request: NextRequest) {
  await requireAdmin(request);
  const { page, limit, offset } = pagination(new URL(request.url).searchParams);
  const db = getDb();
  const total = await db.get<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM timeline",
  );
  const rows = await db.all(
    "SELECT * FROM timeline ORDER BY sort_order, id LIMIT $1 OFFSET $2",
    [limit, offset],
  );
  return apiPaginated(rows, Number(total?.count || 0), page, limit);
});

export const POST = withApi(async function POST(request: NextRequest) {
  const user = await requireAdmin(request);

  const body = await request.json();
  const validation = timelineSchema.safeParse(body);
  if (!validation.success) return apiError(validation.error.errors[0].message);

  const d = validation.data;
  const db = getDb();
  const result = await db.run(
    "INSERT INTO timeline (title, description, date, category, icon, sort_order) VALUES ($1, $2, $3, $4, $5, $6)",
    [d.title, d.description, d.date, d.category, d.icon || "", d.sort_order],
  );

  await logAuditAction(
    user.id,
    "TIMELINE_CREATED",
    `timeline:${result.lastInsertRowid}`,
    getClientIp(request),
  );
  return apiSuccess({ id: result.lastInsertRowid }, 201);
});
