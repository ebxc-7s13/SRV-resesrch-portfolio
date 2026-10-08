import { withApi, pagination } from "@/lib/api-handler";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, logAuditAction } from "@/lib/auth";
import { validateBody, postSchema } from "@/lib/validation";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiPaginated,
  getClientIp,
} from "@/lib/api-utils";

// GET: List posts (admin view - includes drafts)
export const GET = withApi(async function GET(request: NextRequest) {
  const user = await requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = pagination(searchParams);

  const db = getDb();
  const totalRow = await db.get<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM posts",
  );
  const total = Number(totalRow?.count ?? 0);
  const posts = await db.all(
    `SELECT p.*, u.name as author_name
     FROM posts p
     LEFT JOIN users u ON p.author_id = u.id
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

  return apiPaginated(posts, total, page, limit);
});

// POST: Create a new post
export const POST = withApi(async function POST(request: NextRequest) {
  const user = await requireAdmin(request);

  const validation = await validateBody(request, postSchema);
  if (!validation.success) {
    return apiError(validation.error);
  }

  const { title, slug, content, excerpt, cover_image, published } =
    validation.data;

  // Check for duplicate slug
  const db = getDb();
  const existing = await db.get("SELECT id FROM posts WHERE slug = $1", [slug]);
  if (existing) {
    return apiError("A post with this slug already exists");
  }

  try {
    const result = await db.run(
      `INSERT INTO posts (title, slug, content, excerpt, cover_image, published, author_id, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        title,
        slug,
        content,
        excerpt,
        cover_image || null,
        published ? 1 : 0,
        user.id,
        published ? new Date().toISOString() : null,
      ],
    );

    await logAuditAction(
      user.id,
      "POST_CREATED",
      `posts:${result.lastInsertRowid}`,
      getClientIp(request),
    );

    return apiSuccess({ id: result.lastInsertRowid }, 201);
  } catch (error) {
    return apiError("Failed to create post");
  }
});
