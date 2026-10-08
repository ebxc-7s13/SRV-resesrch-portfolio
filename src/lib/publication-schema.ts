import { z } from "zod";
import { sanitize } from "./validation";
import { isLocalMedia } from "./media";
const text = (max: number) =>
  z.preprocess((v) => v ?? "", z.string().max(max).default(""));
export const publicationSchema = z.object({
  title: z.string().min(1).max(500).transform(sanitize),
  authors: z.string().min(1).max(1000).transform(sanitize),
  journal: z.string().min(1).max(500).transform(sanitize),
  year: z.number().int().min(1900).max(2100),
  status: z.enum([
    "published",
    "accepted",
    "under_review",
    "manuscript",
    "preprint",
  ]),
  doi: text(500).refine(
    (v) => !v || /^10\.\d{4,9}\/\S+$/.test(v),
    "Use a DOI identifier, such as 10.1234/example",
  ),
  abstract: text(15000),
  research_area: text(500),
  pdf_url: text(500).refine(
    (v) => !v || /^https:\/\/[^\s]+$/i.test(v) || isLocalMedia(v, "document"),
    "Use an HTTPS URL or an existing PDF in /research/",
  ),
  sort_order: z.number().int().min(0).max(1000).default(0),
});
