import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { apiSuccess } from "@/lib/api-utils";
import { withApi } from "@/lib/api-handler";
export const GET = withApi(async (request: NextRequest) => {
  await requireAdmin(request);
  const db = getDb();
  const [posts, projects, publications, messages, theses, patents, timeline, themes, unread] =
    await Promise.all([
      db.get<{ count: number }>("SELECT COUNT(*)::int AS count FROM posts"),
      db.get<{ count: number }>("SELECT COUNT(*)::int AS count FROM projects"),
      db.get<{ count: number }>("SELECT COUNT(*)::int AS count FROM publications"),
      db.get<{ count: number }>("SELECT COUNT(*)::int AS count FROM messages"),
      db.get<{ count: number }>("SELECT COUNT(*)::int AS count FROM theses"),
      db.get<{ count: number }>("SELECT COUNT(*)::int AS count FROM patents"),
      db.get<{ count: number }>("SELECT COUNT(*)::int AS count FROM timeline"),
      db.get<{ count: number }>("SELECT COUNT(*)::int AS count FROM research_themes"),
      db.get<{ count: number }>(
        "SELECT COUNT(*)::int AS count FROM messages WHERE read=0",
      ),
    ]);
  const stats: Record<string, number> = {
    posts: posts?.count || 0,
    projects: projects?.count || 0,
    publications: publications?.count || 0,
    messages: messages?.count || 0,
    theses: theses?.count || 0,
    patents: patents?.count || 0,
    timeline: timeline?.count || 0,
    themes: themes?.count || 0,
    unreadMessages: unread?.count || 0,
  };
  return apiSuccess(stats);
});
