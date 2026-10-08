import { contentRegistry } from "@/lib/content-registry";
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
import { sanitize } from "@/lib/validation";
import { z } from "zod";

const siteContentSchema = z.object({
  page: z.string().min(1).max(100).transform(sanitize),
  key: z.string().min(1).max(100).transform(sanitize),
  value: z.string().max(10000).default(""),
});

export const GET = withApi(async function GET(request: NextRequest) {
  await requireAdmin(request);
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page");
  const key = searchParams.get("key");

  let items;
  if (page && key) {
    items = await db.get(
      "SELECT * FROM site_content WHERE page = $1 AND key = $2",
      [page, key],
    );
  } else if (page) {
    items = await db.all(
      "SELECT * FROM site_content WHERE page = $1 ORDER BY key ASC",
      [page],
    );
  } else {
    items = await db.all(
      "SELECT * FROM site_content ORDER BY page ASC, key ASC",
    );
  }

  return apiSuccess(items);
});

export const POST = withApi(async function POST(request: NextRequest) {
  const user = await requireAdmin(request);

  const body = await request.json();
  const validation = siteContentSchema.safeParse(body);
  if (!validation.success) return apiError(validation.error.errors[0].message);

  const d = validation.data;
  if (!contentRegistry[d.page]?.some((field) => field.key === d.key))
    return apiError("This content slot is not displayed publicly.");
  const db = getDb();

  try {
    // Upsert - insert or update
    const result = await db.run(
      `
      INSERT INTO site_content (page, key, value)
      VALUES ($1, $2, $3)
      ON CONFLICT(page, key) DO UPDATE SET value = excluded.value, updated_at = NOW()
    `,
      [d.page, d.key, d.value],
    );

    await logAuditAction(
      user.id,
      "SITE_CONTENT_UPDATED",
      `site_content:${d.page}:${d.key}`,
      getClientIp(request),
    );
    return apiSuccess({ id: result.lastInsertRowid }, 201);
  } catch (error) {
    return apiError("Failed to save content");
  }
});

export const DELETE = withApi(async function DELETE(request: NextRequest) {
  const user = await requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return apiError("ID required");

  const db = getDb();
  await db.run("DELETE FROM site_content WHERE id = $1", [id]);
  await logAuditAction(
    user.id,
    "SITE_CONTENT_DELETED",
    `site_content:${id}`,
    getClientIp(request),
  );
  return apiSuccess({ message: "Deleted" });
});
