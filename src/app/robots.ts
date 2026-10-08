import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    ...(process.env.NEXT_PUBLIC_SITE_URL
      ? {
          sitemap: new URL("/sitemap.xml", process.env.NEXT_PUBLIC_SITE_URL)
            .href,
        }
      : {}),
  };
}
