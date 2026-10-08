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
import { safeDocumentUrlSchema } from "@/lib/safe-url";
import { z } from "zod";

const thesisSchema = z.object({
  title: z.string().min(1).max(500).transform(sanitize),
  degree: z.string().min(1).max(200).transform(sanitize),
  institution: z.string().min(1).max(500).transform(sanitize),
  supervisor: z.string().min(1).max(200).transform(sanitize),
  year: z.string().min(1).max(50).transform(sanitize),
  research_problem: z.string().min(1).max(5000).transform(sanitize),
  objective: z.string().min(1).max(5000).transform(sanitize),
  methodology: z.string().min(1).max(5000).transform(sanitize),
  key_contributions: z.string().min(1).max(5000).transform(sanitize),
  results: z.string().min(1).max(5000).transform(sanitize),
  conclusions: z.string().max(5000).optional().default(""),
  future_work: z.string().max(5000).optional().default(""),
  pdf_url: safeDocumentUrlSchema(),
  sort_order: z.number().int().min(0).max(1000).default(0),
});

export const GET = withApi(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin(request);
  const { id } = await params;
  const db = getDb();
  const thesis = await db.get("SELECT * FROM theses WHERE id = $1", [id]);
  if (!thesis) return apiNotFound("Thesis not found");
  return apiSuccess(thesis);
});

export const PUT = withApi(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireAdmin(request);

  const body = await request.json();
  const validation = thesisSchema.safeParse(body);
  if (!validation.success) return apiError(validation.error.errors[0].message);

  const d = validation.data;
  const db = getDb();
  const existing = await db.get("SELECT id FROM theses WHERE id = $1", [id]);
  if (!existing) return apiNotFound("Thesis not found");

  await db.run(
    `
    UPDATE theses SET title=$1, degree=$2, institution=$3, supervisor=$4, year=$5,
      research_problem=$6, objective=$7, methodology=$8, key_contributions=$9,
      results=$10, conclusions=$11, future_work=$12, pdf_url=$13, sort_order=$14
    WHERE id = $15
  `,
    [
      d.title,
      d.degree,
      d.institution,
      d.supervisor,
      d.year,
      d.research_problem,
      d.objective,
      d.methodology,
      d.key_contributions,
      d.results,
      d.conclusions,
      d.future_work,
      d.pdf_url || null,
      d.sort_order,
      id,
    ],
  );

  await logAuditAction(
    user.id,
    "THESIS_UPDATED",
    `theses:${id}`,
    getClientIp(request),
  );
  return apiSuccess({ message: "Thesis updated" });
});

export const DELETE = withApi(async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireAdmin(request);

  const db = getDb();
  await db.run("DELETE FROM theses WHERE id = $1", [id]);
  await logAuditAction(
    user.id,
    "THESIS_DELETED",
    `theses:${id}`,
    getClientIp(request),
  );
  return apiSuccess({ message: "Thesis deleted" });
});
