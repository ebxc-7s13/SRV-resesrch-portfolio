import { z } from "zod";
import { isLocalMedia } from "./media";

/**
 * Shared URL-scheme guard for admin-entered links that are rendered as
 * hrefs on public pages (publication and thesis PDFs, media documents).
 *
 * Only HTTPS absolute URLs and existing local /research/ files are accepted;
 * javascript:, data:, vbscript: and other scheme-injection vectors are
 * rejected at write time. Public renderers additionally guard at read time
 * (see safeExternalHref) so records stored before this rule existed can
 * never become live links either.
 */

/** Read-time guard: returns the href only when it is safe to render. */
export function safeExternalHref(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Local research documents are same-origin by construction.
  if (trimmed.startsWith("/research/")) return trimmed;
  // Everything else must be an absolute HTTPS URL; URL parsing rejects
  // javascript:, data:, whitespace-embedded and malformed schemes.
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Write-time schema: empty string allowed (no link), otherwise HTTPS or local PDF. */
export const safeDocumentUrlSchema = (max = 500) =>
  z
    .string()
    .max(max)
    .optional()
    .default("")
    .refine(
      (v) => !v || !!safeExternalHref(v),
      "Use an HTTPS URL or an existing document in /research/",
    );
