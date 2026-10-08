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

const patentSchema = z.object({
  title: z.string().min(1).max(500).transform(sanitize),
  inventors: z.string().min(1).max(500).transform(sanitize),
  applicant: z.string().min(1).max(500).transform(sanitize),
  status: z.enum(["granted", "filed", "pending", "search_report"]),
  description: z.string().min(1).max(5000).transform(sanitize),
  innovation: z.string().min(1).max(5000).transform(sanitize),
  research_area: z.string().max(500).optional().default(""),
  sort_order: z.number().int().min(0).max(1000).default(0),
});

export const GET = withApi(async function GET(request: NextRequest) {
  await requireAdmin(request);
  const { page, limit, offset } = pagination(new URL(request.url).searchParams);
  const db = getDb();
  const total = await db.get<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM patents",
  );
  const rows = await db.all(
    "SELECT * FROM patents ORDER BY sort_order, id LIMIT $1 OFFSET $2",
    [limit, offset],
  );
  return apiPaginated(rows, Number(total?.count || 0), page, limit);
});

export const POST = withApi(async function POST(request: NextRequest) {
  const user = await requireAdmin(request);

  const body = await request.json();
  const validation = patentSchema.safeParse(body);
  if (!validation.success) return apiError(validation.error.errors[0].message);

  const d = validation.data;
  const db = getDb();
  const result = await db.run(
    `INSERT INTO patents (title, inventors, applicant, status, description, innovation, research_area, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      d.title,
      d.inventors,
      d.applicant,
      d.status,
      d.description,
      d.innovation,
      d.research_area || "",
      d.sort_order,
    ],
  );

  await logAuditAction(
    user.id,
    "PATENT_CREATED",
    `patents:${result.lastInsertRowid}`,
    getClientIp(request),
  );
  return apiSuccess({ id: result.lastInsertRowid }, 201);
});
