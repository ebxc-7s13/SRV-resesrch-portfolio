import { withApi } from "@/lib/api-handler";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, logAuditAction } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  getClientIp,
} from "@/lib/api-utils";
import { z } from "zod";
import { sanitize } from "@/lib/validation";

const patentUpdateSchema = z.object({
  id: z.number().int(),
  // Same strip-all sanitization as the single-record create/update schemas:
  // these fields render on public pages, so the batch path must not accept
  // markup the other write paths reject.
  description: z.string().min(1).max(5000).transform(sanitize),
  innovation: z.string().min(1).max(5000).transform(sanitize),
});

const batchSchema = z.object({
  patents: z.array(patentUpdateSchema).min(1).max(10),
});

export const POST = withApi(async function POST(request: NextRequest) {
  const user = await requireAdmin(request);

  const body = await request.json();
  const validation = batchSchema.safeParse(body);
  if (!validation.success) return apiError(validation.error.errors[0].message);

  const db = getDb();

  let updated = 0;
  for (const p of validation.data.patents) {
    const result = await db.run(
      "UPDATE patents SET description = $1, innovation = $2 WHERE id = $3",
      [p.description, p.innovation, p.id],
    );
    if (result.changes > 0) updated++;
  }

  await logAuditAction(
    user.id,
    "PATENTS_BATCH_UPDATE",
    `patents:${updated} updated`,
    getClientIp(request),
  );
  return apiSuccess({ message: `${updated} patents updated`, updated });
});
