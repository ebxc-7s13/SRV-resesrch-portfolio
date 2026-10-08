import { withApi } from "@/lib/api-handler";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, logAuditAction } from "@/lib/auth";
import { validateBody, postSchema } from "@/lib/validation";
import {
  apiSuccess,
  apiError,
  apiNotFound,
  apiUnauthorized,
  getClientIp,
} from "@/lib/api-utils";
import { generateSlug } from "@/lib/validation";

export const GET = withApi(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin(request);
  const { id } = await params;
  const db = getDb();
  const post = await db.get(
    "SELECT p.*, u.name as author_name FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE p.id = $1",
    [id],
  );
  if (!post) return apiNotFound("Post not found");
  return apiSuccess(post);
});

export const PUT = withApi(async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireAdmin(request);

  const validation = await validateBody(request, postSchema);
  if (!validation.success) return apiError(validation.error);

  const { title, slug, content, excerpt, cover_image, published } =
    validation.data;
  const finalSlug = slug || generateSlug(title);

  const db = getDb();
  const existing = await db.get("SELECT id FROM posts WHERE id = $1", [id]);
  if (!existing) return apiNotFound("Post not found");

  const slugConflict = await db.get(
    "SELECT id FROM posts WHERE slug = $1 AND id != $2",
    [finalSlug, id],
  );
  if (slugConflict) return apiError("A post with this slug already exists");

  await db.run(
    `
    UPDATE posts SET
      title = $1, slug = $2, content = $3, excerpt = $4, cover_image = $5,
      published = $6, published_at = CASE WHEN $7 = 1 AND published = 0 THEN NOW() ELSE published_at END,
      updated_at = NOW()
    WHERE id = $8
  `,
    [
      title,
      finalSlug,
      content,
      excerpt,
      cover_image || null,
      published ? 1 : 0,
      published ? 1 : 0,
      id,
    ],
  );

  await logAuditAction(
    user.id,
    "POST_UPDATED",
    `posts:${id}`,
    getClientIp(request),
  );
  return apiSuccess({ message: "Post updated" });
});

export const DELETE = withApi(async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireAdmin(request);

  const db = getDb();
  const existing = await db.get("SELECT id FROM posts WHERE id = $1", [id]);
  if (!existing) return apiNotFound("Post not found");

  await db.run("DELETE FROM posts WHERE id = $1", [id]);
  await logAuditAction(
    user.id,
    "POST_DELETED",
    `posts:${id}`,
    getClientIp(request),
  );
  return apiSuccess({ message: "Post deleted" });
});
