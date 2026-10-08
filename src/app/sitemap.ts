import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) return [];
  const [projects, notes] = await Promise.all([
    getDb().all<{ slug: string }>("SELECT slug FROM projects"),
    getDb().all<{ slug: string }>("SELECT slug FROM posts WHERE published=1"),
  ]);
  const paths = [
    "/",
    "/lab",
    "/research",
    "/publications",
    "/thesis",
    "/patents",
    "/timeline",
    "/blog",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    ...projects.map((p) => "/research/" + p.slug),
    ...notes.map((p) => "/blog/" + p.slug),
  ];
  return paths.map((path) => ({ url: new URL(path, origin).href }));
}
