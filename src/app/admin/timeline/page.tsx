"use client";

import { CmsList } from "@/components/AdminCms";

const timelineFields = [
  { key: "title", label: "Title", type: "text" as const, required: true },
  {
    key: "description",
    label: "Description",
    type: "textarea" as const,
    required: true,
    rows: 3,
  },
  {
    key: "date",
    label: "Date",
    type: "text" as const,
    required: true,
    placeholder: "2026",
  },
  {
    key: "category",
    label: "Category",
    type: "select" as const,
    required: true,
    options: [
      { value: "education", label: "Education" },
      { value: "research", label: "Research" },
      { value: "publication", label: "Publication" },
      { value: "patent", label: "Patent" },
      { value: "project", label: "Project" },
      { value: "startup", label: "Startup" },
      { value: "award", label: "Award" },
    ],
  },
  { key: "icon", label: "Icon", type: "text" as const, placeholder: "🔬" },
  { key: "sort_order", label: "Sort Order", type: "number" as const },
];

const timelineColumns = [
  { key: "title", label: "Title" },
  { key: "category", label: "Category" },
  { key: "date", label: "Date" },
];

export default function AdminTimelinePage() {
  return (
    <CmsList
      title="Timeline"
      apiBase="/api/admin/timeline"
      fields={timelineFields}
      columns={timelineColumns}
    />
  );
}
