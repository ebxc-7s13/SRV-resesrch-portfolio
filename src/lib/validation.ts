import { isLocalMedia } from "./media";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";

// Sanitize HTML content (strip all tags by default)
export function sanitize(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}

// Allow some HTML for blog content
export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "i",
      "b",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "blockquote",
      "pre",
      "code",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "div",
      "span",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      pre: ["class"],
      code: ["class"],
      "*": ["rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tagName, attribs) => {
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            rel: "noopener noreferrer",
          },
        };
      },
    },
  }).trim();
}

const optionalText = z.preprocess(
  (v) => (v == null ? "" : v),
  z.string().max(5000).default(""),
);
const slugSchema = z.preprocess(
  (v) => (v == null ? "" : v),
  z
    .string()
    .max(200)
    .regex(
      /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/,
      "Use lowercase letters, digits and hyphens",
    )
    .default(""),
);
const coverSchema = z.preprocess(
  (v) => (v == null ? "" : v),
  z
    .string()
    .max(500)
    .refine(
      (v) => !v || isLocalMedia(v),
      "Choose an existing image in /research/",
    )
    .default(""),
);
const withSlug = <T extends { title: string; slug: string }>(data: T) => ({
  ...data,
  slug: data.slug || generateSlug(data.title),
});

// Login validation
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .max(255, "Email too long"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password too long"),
});

// Blog post validation
export const postSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(200, "Title too long")
      .transform(sanitize),
    slug: slugSchema,
    content: z
      .string()
      .min(1, "Content is required")
      .max(50000, "Content too long")
      .transform(sanitizeRichText),
    excerpt: z
      .string()
      .min(1, "Excerpt is required")
      .max(500, "Excerpt too long")
      .transform(sanitize),
    cover_image: coverSchema,
    published: z.boolean().default(false),
  })
  .transform(withSlug)
  .refine((d) => !!d.slug, "Provide a slug using Latin letters or digits");

// Project validation (research project case-study format)
export const projectSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(300, "Title too long")
      .transform(sanitize),
    slug: slugSchema,
    research_problem: z
      .string()
      .min(1, "Research problem is required")
      .max(5000, "Too long")
      .transform(sanitize),
    motivation: z
      .string()
      .min(1, "Motivation is required")
      .max(5000, "Too long")
      .transform(sanitize),
    approach: z
      .string()
      .min(1, "Approach is required")
      .max(5000, "Too long")
      .transform(sanitize),
    methodology: optionalText,
    experimental_setup: optionalText,
    hardware: optionalText,
    data_acquisition: optionalText,
    computational_method: optionalText,
    results: z
      .string()
      .min(1, "Results are required")
      .max(5000, "Too long")
      .transform(sanitize),
    key_contribution: z
      .string()
      .min(1, "Key contribution is required")
      .max(5000, "Too long")
      .transform(sanitize),
    status: z
      .enum(["completed", "ongoing", "under_review", "filed"])
      .default("ongoing"),
    featured: z.boolean().default(false),
    sort_order: z.number().int().min(0).max(1000).default(0),
    cover_image: coverSchema,
  })
  .transform(withSlug)
  .refine((d) => !!d.slug, "Provide a slug using Latin letters or digits");

// Contact form validation
export const contactSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .transform(sanitize),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .max(255, "Email too long"),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject too long")
    .transform(sanitize),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000, "Message too long")
    .transform(sanitize),
  // Honeypot field - must be empty
  website: z.string().max(0, "Bot detected").optional().default(""),
  // Timestamp - must be at least 3 seconds after page load
  timestamp: z.string().refine((v) => {
    const age = Date.now() - Number(v);
    return Number.isFinite(age) && age >= 3000 && age <= 86400000;
  }, "Please wait a few seconds before sending, or reload an expired form"),
});

// Password change validation
export const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .max(128, "Password too long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/,
        "Password must contain uppercase, lowercase, number, and special character",
      ),
    confirm_password: z.string().min(1, "Please confirm password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

// Helper: validate request body
export async function validateBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const raw = await request.json();
    const body =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? Object.fromEntries(
            Object.entries(raw).map(([k, v]) => [k, v === null ? "" : v]),
          )
        : raw;

    // Check for honeypot (spam bot detection)
    if (body.website && body.website !== "") {
      return { success: false, error: "Spam detected" };
    }

    const result = schema.safeParse(body);
    if (!result.success) {
      const firstError = result.error.errors[0];
      return {
        success: false,
        error: `${firstError.path.join(".")}: ${firstError.message}`,
      };
    }
    return { success: true, data: result.data };
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
}

// Search validation
export const searchSchema = z.object({
  query: z.string().min(1, "Search query required").max(200, "Query too long"),
  type: z.enum(["all", "projects", "publications", "posts"]).default("all"),
});

// Helper: validate query params
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>,
): { success: true; data: T } | { success: false; error: string } {
  const obj = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(obj);
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors[0]?.message || "Invalid query parameters",
    };
  }
  return { success: true, data: result.data };
}

// Slug generator from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}
