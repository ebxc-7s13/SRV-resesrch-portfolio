// Stone Mode routing: the monochromatic limestone variant of the portfolio
// lives under /stone and re-uses every original page. This module is the one
// place that knows which routes have a stone counterpart.

export const STONE_PREFIX = "/stone";

/** Original route prefixes that have a stone counterpart. */
export const STONE_ROUTES = [
  "/",
  "/about",
  "/blog",
  "/contact",
  "/lab",
  "/patents",
  "/privacy",
  "/publications",
  "/research",
  "/search",
  "/terms",
  "/thesis",
  "/timeline",
] as const;

/** Routes deliberately kept out of Stone Mode. */
const EXCLUDED = ["/admin", "/play", "/lab/models", "/api", "/stone"];

export function isStonePath(pathname: string | null | undefined): boolean {
  return !!pathname && (pathname === STONE_PREFIX || pathname.startsWith(`${STONE_PREFIX}/`));
}

/** The original route for a stone route (and the identity for others). */
export function toOriginalPath(pathname: string): string {
  if (!isStonePath(pathname)) return pathname;
  const rest = pathname.slice(STONE_PREFIX.length);
  return rest === "" ? "/" : rest;
}

function hasCounterpart(pathname: string) {
  if (EXCLUDED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  return STONE_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Map an internal href (path, optional query and hash) to its stone
 * counterpart. Returns null when the link must keep its destination:
 * external URLs, files, API calls, hash-only links and routes without a
 * stone version.
 */
export function toStoneHref(href: string): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  const match = /^([^?#]*)([?#].*)?$/.exec(href);
  const path = match?.[1] || "/";
  const suffix = match?.[2] ?? "";
  if (isStonePath(path)) return null;
  if (/\.[a-z0-9]+$/i.test(path)) return null; // static files (PDF, MD, images)
  if (!hasCounterpart(path)) return null;
  return `${STONE_PREFIX}${path === "/" ? "" : path}${suffix}`;
}
