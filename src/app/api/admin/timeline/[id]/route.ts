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

export const GET = withApi(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin(request);
  const { id } = await params;
  const db = getDb();
  const entry = await db.get("SELECT * FROM timeline WHERE id = $1", [id]);
  if (!entry) return apiNotFound("Timeline entry not found");
  return apiSuccess(entry);
});

export const PUT = withApi(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireAdmin(request);

  const body = await request.json();
  const validation = timelineSchema.safeParse(body);
  if (!validation.success) return apiError(validation.error.errors[0].message);

  const d = validation.data;
  const db = getDb();
  const existing = await db.get("SELECT id FROM timeline WHERE id = $1", [id]);
  if (!existing) return apiNotFound("Timeline entry not found");

  await db.run(
    "UPDATE timeline SET title=$1, description=$2, date=$3, category=$4, icon=$5, sort_order=$6 WHERE id=$7",
    [
      d.title,
      d.description,
      d.date,
      d.category,
      d.icon || "",
      d.sort_order,
      id,
    ],
  );

  await logAuditAction(
    user.id,
    "TIMELINE_UPDATED",
    `timeline:${id}`,
    getClientIp(request),
  );
  return apiSuccess({ message: "Timeline entry updated" });
});

export const DELETE = withApi(async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireAdmin(request);

  const db = getDb();
  await db.run("DELETE FROM timeline WHERE id = $1", [id]);
  await logAuditAction(
    user.id,
    "TIMELINE_DELETED",
    `timeline:${id}`,
    getClientIp(request),
  );
  return apiSuccess({ message: "Timeline entry deleted" });
});
