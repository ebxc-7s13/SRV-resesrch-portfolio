import { realpathSync, statSync } from "node:fs";
import path from "node:path";

export function isLocalMedia(
  value: string,
  kind: "image" | "video" | "document" = "image",
): boolean {
  if (
    !value.startsWith("/research/") ||
    /[\\%?#\u0000]/.test(value) ||
    value.split("/").includes("..")
  )
    return false;
  const extensions = {
    image: /\.(png|jpe?g|webp|gif|avif)$/i,
    video: /\.(mp4|webm)$/i,
    document: /\.pdf$/i,
  };
  if (!extensions[kind].test(value)) return false;
  try {
    const root = realpathSync(path.join(process.cwd(), "public", "research"));
    const file = realpathSync(path.join(process.cwd(), "public", value));
    return file.startsWith(root + path.sep) && statSync(file).isFile();
  } catch {
    return false;
  }
}
