import { isIP } from "node:net";

/** Trust only the explicitly configured number of appending proxy hops. */
export function getClientIp(request: Request): string | null {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS || "0");
  if (!Number.isInteger(hops) || hops < 1) {
    const host = new URL(request.url).hostname;
    return process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(host)
      ? "127.0.0.1"
      : null;
  }
  const chain =
    request.headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((s) => s.trim()) || [];
  const ip = chain[chain.length - hops];
  return ip && isIP(ip) ? ip : null;
}
