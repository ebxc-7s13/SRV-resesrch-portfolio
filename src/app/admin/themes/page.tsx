"use client";

import { CmsList } from "@/components/AdminCms";

const themeFields = [
  { key: "title", label: "Title", type: "text" as const, required: true },
  {
    key: "description",
    label: "Description",
    type: "textarea" as const,
    required: true,
    rows: 3,
  },
  { key: "icon", label: "Icon", type: "text" as const, placeholder: "🔬" },
  { key: "sort_order", label: "Sort Order", type: "number" as const },
];

const themeColumns = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
];

export default function AdminThemesPage() {
  return (
    <CmsList
      title="Research Themes"
      apiBase="/api/admin/themes"
      fields={themeFields}
      columns={themeColumns}
    />
  );
}
