"use client";

import { CmsList } from "@/components/AdminCms";

const postFields = [
  { key: "title", label: "Title", type: "text" as const, required: true },
  {
    key: "slug",
    label: "Slug",
    type: "text" as const,
    helpText: "Auto-generated from title if left empty",
  },
  {
    key: "excerpt",
    label: "Excerpt",
    type: "textarea" as const,
    required: true,
    rows: 2,
  },
  {
    key: "content",
    label: "Content (HTML)",
    type: "textarea" as const,
    required: true,
    rows: 10,
    placeholder: "Write your research note in HTML...",
  },
  {
    key: "cover_image",
    label: "Cover Image Path",
    type: "text" as const,
    placeholder: "/research/oral-cancer/model.png",
  },
  { key: "published", label: "Published", type: "checkbox" as const },
];

const postColumns = [
  { key: "title", label: "Title" },
  { key: "published", label: "Status" },
];

export default function AdminPostsPage() {
  return (
    <CmsList
      title="Research Notes"
      apiBase="/api/admin/posts"
      fields={postFields}
      columns={postColumns}
    />
  );
}
