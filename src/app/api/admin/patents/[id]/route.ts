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

export const GET = withApi(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin(request);
  const { id } = await params;
  const db = getDb();
  const patent = await db.get("SELECT * FROM patents WHERE id = $1", [id]);
  if (!patent) return apiNotFound("Patent not found");
  return apiSuccess(patent);
});

export const PUT = withApi(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireAdmin(request);

  const body = await request.json();
  const validation = patentSchema.safeParse(body);
  if (!validation.success) return apiError(validation.error.errors[0].message);

  const d = validation.data;
  const db = getDb();
  const existing = await db.get("SELECT id FROM patents WHERE id = $1", [id]);
  if (!existing) return apiNotFound("Patent not found");

  await db.run(
    `
    UPDATE patents SET title=$1, inventors=$2, applicant=$3, status=$4, description=$5,
      innovation=$6, research_area=$7, sort_order=$8
    WHERE id = $9
  `,
    [
      d.title,
      d.inventors,
      d.applicant,
      d.status,
      d.description,
      d.innovation,
      d.research_area || "",
      d.sort_order,
      id,
    ],
  );

  await logAuditAction(
    user.id,
    "PATENT_UPDATED",
    `patents:${id}`,
    getClientIp(request),
  );
  return apiSuccess({ message: "Patent updated" });
});

export const DELETE = withApi(async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireAdmin(request);

  const db = getDb();
  await db.run("DELETE FROM patents WHERE id = $1", [id]);
  await logAuditAction(
    user.id,
    "PATENT_DELETED",
    `patents:${id}`,
    getClientIp(request),
  );
  return apiSuccess({ message: "Patent deleted" });
});
