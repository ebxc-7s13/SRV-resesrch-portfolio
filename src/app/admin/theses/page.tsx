"use client";

import { CmsList } from "@/components/AdminCms";

const thesisFields = [
  { key: "title", label: "Title", type: "text" as const, required: true },
  {
    key: "degree",
    label: "Degree",
    type: "text" as const,
    required: true,
    placeholder: "Master of Technology (M.Tech)",
  },
  {
    key: "institution",
    label: "Institution",
    type: "text" as const,
    required: true,
  },
  {
    key: "supervisor",
    label: "Supervisor",
    type: "text" as const,
    required: true,
  },
  {
    key: "year",
    label: "Year",
    type: "text" as const,
    required: true,
    placeholder: "2024-2026",
  },
  {
    key: "research_problem",
    label: "Research Problem",
    type: "textarea" as const,
    required: true,
    rows: 4,
  },
  {
    key: "objective",
    label: "Objective",
    type: "textarea" as const,
    required: true,
    rows: 3,
  },
  {
    key: "methodology",
    label: "Methodology",
    type: "textarea" as const,
    required: true,
    rows: 5,
  },
  {
    key: "key_contributions",
    label: "Key Contributions",
    type: "textarea" as const,
    required: true,
    rows: 5,
  },
  {
    key: "results",
    label: "Results",
    type: "textarea" as const,
    required: true,
    rows: 5,
  },
  {
    key: "conclusions",
    label: "Conclusions",
    type: "textarea" as const,
    rows: 3,
  },
  {
    key: "future_work",
    label: "Future Work",
    type: "textarea" as const,
    rows: 3,
  },
  {
    key: "pdf_url",
    label: "PDF URL (hidden from frontend)",
    type: "text" as const,
    placeholder: "Internal use only — not displayed on website",
  },
  { key: "sort_order", label: "Sort Order", type: "number" as const },
];

const thesisColumns = [
  { key: "title", label: "Title" },
  { key: "degree", label: "Degree" },
  { key: "year", label: "Year" },
];

export default function AdminThesesPage() {
  return (
    <CmsList
      title="Theses"
      apiBase="/api/admin/theses"
      fields={thesisFields}
      columns={thesisColumns}
    />
  );
}
